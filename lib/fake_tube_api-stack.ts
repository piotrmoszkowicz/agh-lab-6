import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as nodejsLambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
// DO_SOMETHING_EX_2 - Import WafConstruct HERE

interface FakeTubeApiProps extends StackProps {
  table: dynamodb.Table;
  vpc: ec2.Vpc;
}

export class FakeTubeApiStack extends Stack {
  constructor(scope: Construct, id: string, props: FakeTubeApiProps) {
    super(scope, id, props);

    const api = new apigateway.RestApi(this, "videos-api", {
      cloudWatchRole: false, // Needed as hack for AWS Academy, usually you don't need to specify that
      restApiName: "Videos API Service",
      description: "This service serves videos."
    });

    // DO_SOMETHING_EX_2 - Create WafConstruct HERE

    const handler = new nodejsLambda.NodejsFunction(this, "VideoHandler", {
      runtime: lambda.Runtime.NODEJS_14_X,
      entry: 'resources/videos.ts',
      role: iam.Role.fromRoleName(this, "LabRole", "LabRole"),
      environment: {
        VIDEOS_TABLE_NAME: props.table.tableName
      },
      // DO_SOMETHING_EX_1 - Add this Lambda to VPC
    });

    const videosResource = api.root.addResource('videos');

    const videosIntegration = new apigateway.LambdaIntegration(handler, {
      requestTemplates: { "application/json": '{ "statusCode": "200" }' }
    });

    videosResource.addMethod("GET", videosIntegration);

    const videoItemResource = videosResource.addResource('{id}')
    videoItemResource.addMethod("GET", videosIntegration);

    // create model for payload validation
    const videoModel = new apigateway.Model(this, "post-videos-validator", {
      restApi: api,
      contentType: "application/json",
      description: "To validate video create payload",
      modelName: "videomodelcdk",

      // schema (allowed shape) of our payload
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ["title"],
        properties: {
          title: { type: apigateway.JsonSchemaType.STRING },
        },
      }
    });


    // create request validation API Gateway resource
    const requestValidator = new apigateway.RequestValidator(
      this,
      "body-validator",
      {
        restApi: api,
        requestValidatorName: "body-validator",
        validateRequestBody: true,
      }
    )

    // create new endpoint (POST /videos) - validator and model are configuration options
    videosResource.addMethod('POST', videosIntegration, {
      requestValidator,
      requestModels: {
        "$default": videoModel
      },
    });
  }
}
