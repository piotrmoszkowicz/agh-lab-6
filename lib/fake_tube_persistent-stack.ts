import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export class FakeTubePersistentStack extends Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.table = new dynamodb.Table(this, 'VideoTable', {
      partitionKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
    });
  }
}
