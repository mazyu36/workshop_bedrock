import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { TestKnowledgeBases } from './constructs/02_0_test-knowledge-bases';
import { TestAgent } from './constructs/05_0_test-agent';

export class WorkshopBedrockStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new TestKnowledgeBases(this, 'TestKnowledgeBases', {});
    new TestAgent(this,'TestAgent',{});
  }
}
