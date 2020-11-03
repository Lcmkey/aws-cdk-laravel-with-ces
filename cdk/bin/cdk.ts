#!/usr/bin/env node
require("dotenv").config();

import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { FargateStack } from "../lib/fargate-stack";
import { Ec2Stack } from "../lib/ec2-stack";

/**
 * AWS Account / Region Definition
 */
const {
  PREFIX: prefix = "[STACK PREFIX NAME]",
  STAGE: stage = "[DEPLOYMENT STAGE]",
  CDK_ACCOUNT: accountId = "[AWS ACCOUNT ID]",
  CDK_REGION: region = "ap-southeast-1",
} = process.env;

/**
 * AWS defulat ENV config Definition
 */
const env = {
  account: accountId,
  region: region,
};

const app = new cdk.App();

new FargateStack(app, `${prefix}-${stage}-FargateStack`, {
  env,
  prefix,
  stage,
});

new Ec2Stack(app, `${prefix}-${stage}-Ec2Stack`, { env, prefix, stage });

app.synth();
