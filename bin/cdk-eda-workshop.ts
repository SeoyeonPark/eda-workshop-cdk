#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkEdaWorkshopStack } from '../lib/cdk-eda-workshop-stack';

const app = new cdk.App();
new CdkEdaWorkshopStack(app, 'CdkEdaWorkshopStack', {
  env: { account: '546281408042', region: 'ap-northeast-2'},
});