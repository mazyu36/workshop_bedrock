import { Construct } from 'constructs';
import {
  Duration,
  RemovalPolicy,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
  aws_logs as logs,
  aws_lambda as lambda
} from 'aws-cdk-lib';
import { bedrock, opensearchserverless, opensearch_vectorindex } from '@cdklabs/generative-ai-cdk-constructs';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';

export interface TestAgentProps {

}

export class TestAgent extends Construct {
  constructor(scope: Construct, id: string, props: TestAgentProps) {
    super(scope, id);

    const indexName = 'bedrock-knowledge-base-index';
    const vectorField = 'bedrock-knowledge-base-vector';
    const instruction = `
        You are an agent that can handle various tasks related to insurance claims, including looking up claim
        details, finding what paperwork is outstanding, and sending reminders. Only send reminders if you have been
        explicitly requested to do so. If an user asks about your functionality, provide guidance in natural language
        and do not include function names on the output.`;

    // Vector Store
    const vectorStore = new opensearchserverless.VectorCollection(this, 'VectorCollectionForAgent', {
      collectionName: 'bedrock-collection-for-agent',
      standbyReplicas: opensearchserverless.VectorCollectionStandbyReplicas.DISABLED,
    });

    const vectorIndex = new opensearch_vectorindex.VectorIndex(this, 'VectorIndexForAgent', {
      collection: vectorStore,
      indexName,
      vectorField,
      vectorDimensions: 1536,
      mappings: [
        {
          mappingField: 'bedrock-knowledge-base-text',
          dataType: 'text',
          filterable: true,
        },
        {
          mappingField: 'bedrock-knowledge-base-metadata',
          dataType: 'text',
          filterable: true,
        },
      ],
    });

    // Knowledge Base
    const knowledgeBase = new bedrock.KnowledgeBase(this, 'KnowledgeBaseForAgent', {
      embeddingsModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V1,
      vectorIndex,
      vectorStore,
      indexName,
      vectorField,
      instruction: 'the property for description ',
    });

    const dataSourceBucket = new s3.Bucket(this, 'BucketForAgent', {
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    new s3deploy.BucketDeployment(this, 'DeployDataForAgent', {
      sources: [s3deploy.Source.asset('./data/for-test-agent')],
      destinationBucket: dataSourceBucket,
    });

    new bedrock.S3DataSource(this, 'DataSourceForAgent', {
      bucket: dataSourceBucket,
      knowledgeBase,
      dataSourceName: 'bedrock-sample-knowledge-base-for-agent',
      chunkingStrategy: bedrock.ChunkingStrategy.FIXED_SIZE,
      maxTokens: 512,
      overlapPercentage: 20
    })

    // Agents
    const agent = new bedrock.Agent(this, 'Agent', {
      foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_HAIKU_V1_0,
      instruction,
      idleSessionTTL: Duration.seconds(1800),
    });

    agent.addKnowledgeBase(knowledgeBase);

    // Agent Action Group
    const actionGroupFunction = new PythonFunction(this, 'ActionGroupFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      entry: 'lambda',
      handler: 'lambda_handler',
      timeout: Duration.seconds(60),
      logRetention: logs.RetentionDays.ONE_DAY,
    });

    const actionGroup = new bedrock.AgentActionGroup(this, 'AgentGroup', {
      actionGroupExecutor: {
        lambda: actionGroupFunction,
      },
      actionGroupState: "ENABLED",
      actionGroupName: 'ClaimManagementActionGroup',
      apiSchema:bedrock.ApiSchema.fromAsset('api-schema/insurance_claims_agent_openapi_schema_with_kb.json'),
    });

    agent.addActionGroup(actionGroup);

  }

}