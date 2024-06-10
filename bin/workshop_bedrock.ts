#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WorkshopBedrockStack } from '../lib/workshop_bedrock-stack';

const app = new cdk.App();

new WorkshopBedrockStack(app, 'WorkshopBedrockStack', {
  env: {  region: 'us-east-1' },
});