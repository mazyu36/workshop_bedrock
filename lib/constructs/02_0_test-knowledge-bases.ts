import { Construct } from 'constructs';
import { RemovalPolicy, aws_s3 as s3, aws_s3_deployment as s3deploy } from 'aws-cdk-lib';
import { bedrock, opensearchserverless, opensearch_vectorindex } from '@cdklabs/generative-ai-cdk-constructs';

export interface TestKnowledgeBasesProps {

}

export class TestKnowledgeBases extends Construct {
  constructor(scope: Construct, id: string, props: TestKnowledgeBasesProps) {
    super(scope, id);

    const indexName = 'bedrock-sample-rag';
    const vectorField = 'vector';

    // Vector Store
    const vectorStore = new opensearchserverless.VectorCollection(this, 'VectorCollection', {
      collectionName: 'bedrock-sample-rag',
      standbyReplicas: opensearchserverless.VectorCollectionStandbyReplicas.ENABLED,
    });

    const vectorIndex = new opensearch_vectorindex.VectorIndex(this, 'VectorIndex', {
      collection: vectorStore,
      indexName,
      vectorField,
      vectorDimensions: 1536,
      mappings: [
        {
          mappingField: 'text',
          dataType: 'text',
          filterable: true,
        },
        {
          mappingField: 'text-metadata',
          dataType: 'text',
          filterable: true,
        },
      ],
    });

    // Knowledge Base
    const knowledgeBase = new bedrock.KnowledgeBase(this, 'KnowledgeBase', {
      embeddingsModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V1,
      vectorIndex,
      vectorStore,
      indexName,
      vectorField,
    });

    const dataSourceBucket = new s3.Bucket(this, 'Bucket', {
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    new s3deploy.BucketDeployment(this, 'DeployData', {
      sources: [s3deploy.Source.asset('./data/for-test-knowledge-base')],
      destinationBucket: dataSourceBucket,
    });

    new bedrock.S3DataSource(this, 'DataSource', {
      bucket: dataSourceBucket,
      knowledgeBase,
      dataSourceName: 'bedrock-sample-knowledge-base',
      chunkingStrategy: bedrock.ChunkingStrategy.FIXED_SIZE,
      maxTokens: 512,
      overlapPercentage: 20
    })

  }
}