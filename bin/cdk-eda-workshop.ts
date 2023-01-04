#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EdaWSNetworkStack, EdaWSEcsStack, EdaWSSqsStack, EdaWSSnsStack } from '../lib/cdk-eda-workshop-stack';

const app = new cdk.App();
const networkStack = new EdaWSNetworkStack(app, 'stack-1-infra', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION
  },
});

new EdaWSEcsStack(app, 'stack-2-ecs', {
  vpc: networkStack.vpc,
  repository: networkStack.repository,
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION
  },
});

new EdaWSSqsStack(app, 'stack-sqs', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION
  },
});

new EdaWSSqsStack(app, 'stack-sns', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION
  },
});