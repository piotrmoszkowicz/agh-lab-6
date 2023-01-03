import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export class FakeTubePersistentStack extends Stack {
  public readonly table: dynamodb.Table;
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.table = new dynamodb.Table(this, 'VideoTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
    });

    this.vpc = // DO_SOMETHING_EX_1 - Create VPC
  }
}
