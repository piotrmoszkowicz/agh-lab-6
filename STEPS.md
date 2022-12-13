# Aim of the lab

We will redesign our application from the last labs - we will add videos miniatures, which will be saved
in AWS S3 in event-driven way.

# Prerequisites

1. Installing packages

```
npm install
```

2. Bootstrapping

This will create the project in the AWS.

> ❗️ You can find the `bootstrap-template.yml` file inside the project.

```
cdk bootstrap --template bootstrap-template.yaml 
```

3. Deploy

Run `cdk deploy`. Make sure deployment went well and we have API gatewa that exposes three endpoint:

1. `GET /videos`
2. `POST /videos`
3. `GET /videos/{id}`

For now the responses are fixed. Don't worry we will fix that in upcoming exercises.

# Exercise 1 - Add video ID into DynamoDB.

1. First we need to ensure we pass `id` of YouTube video into our application, so it can be picked up later on.
To do that we need to change validation model of our API. Let's move to `lib/fake_tube_api-stack.ts` file and do the following change:

```diff
schema: {
    type: apigateway.JsonSchemaType.OBJECT,
    required: ["title"],
    properties: {
+       id: { type: apigateway.JsonSchemaType.STRING },
        title: { type: apigateway.JsonSchemaType.STRING },
    },
}
```

2. Now we need to make sure our ID is saved properly into the database. Let's go to `resources/repository.ts` and add ID as `createVideo` function parameter and send it to DynamoDB:
```diff
+export async function createVideo(id: string, title: string): Promise<Video> {
-export async function createVideo(title: string): Promise<Video> {
  const dynamo = getDynamoClient();
- const id = uuid();

  await dynamo.send(new PutCommand({
    TableName: process.env.VIDEOS_TABLE_NAME,
    Item: {
      Id: id,
      Title: title,
    },
  }));

  return {
    id,
    title,
  }
}
```

3. That change will cause TypeScript issue in Lambda handler. Open `resoures/videos.ts` and make the following change:
```diff
if (resource === '/videos' && httpMethod === 'POST') {
    // at this point we are sure the body correct - request validator is guarding that
    // we just need to parse it from string
    // `!` is a TS trick - TS does not know that body was already validated
    const dto = JSON.parse(event.body!)

    // create a video
-   const video = await createVideo(dto.title)
+   const video = await createVideo(dto.id, dto.title)

    // return response
    return {
      statusCode: 201,
      body: JSON.stringify(video)
    };
  }
```

4. Let's deploy the changes and test them:
```sh
$ cdk deploy FakeTubeApiStack
``` 

## Test

Right now we should be able to save our own IDs into DynamoDB Table. Let's validate:

1. Create one video:
```
curl -i -X POST https://<YOUR GW ID>.execute-api.us-east-1.amazonaws.com/prod/videos -d '{"id": "sBbeO5NU7Rk", "title": "BEZ TRZECH MANDATÓW MI NIE WRACAJ! - PATOLOGIA MANDATOWA CZ. 2"}'
```

You should receive `201` status and the body of response should be JSON with you new video.

2. Call our `GET /videos` endpoint

```
curl -i https://<YOUR GW ID>.execute-api.us-east-1.amazonaws.com/prod/videos
```

You should receive list of your videos with previously created item inside.

# Exercise 2 - Create public S3 Bucket

1. Let's move into `lib/fake_tub_persistent-stack.ts` and add S3 Bucket. First add import at the top of file:
```ts
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
```
2. Now let's add the bucket. First we need to have reference for it in our class so it can be later use in other places. Add
```ts
public readonly bucket: s3.Bucket;
``` 

above table property of the class.
3. Now let's create the bucket. Add that snippet into class content:
```ts
this.bucket = new s3.Bucket(this, "VideoMiniaturesBucket", {
  bucketName: `video-miniatures-${Stack.of(this).account}`,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  publicReadAccess: true,
});
``` 
Side question: Explain your teacher what `Stack.of(this).account` does and why is needed here?
4. Let's do the deploy to get our changes into the cloud:
```sh
$ cdk deploy FakeTubeApiStack
``` 

## Test
1. Now let's try to upload file into S3 Object via Web Console. Go to `https://s3.console.aws.amazon.com/s3/buckets?region=us-east-1` and find your bucket (name should start with `video-miniatures`).
2. Pick the bucket. Click on the `Upload` and upload whatever file you want by clicking `Add files` and later `Upload`.
3. Click on the uploaded file name.
4. Click on the `Object URL` and verify you can open the file. 

# Exercise 3 - Create Lambda, which can download YouTube miniature and upload it into S3 Bucket.

1. First let's pass Bucket object into our API Stack - to do so go into `lib/fake_tube_api-stack.ts`
and add import at the top of file:
```ts
import * as s3 from "aws-cdk-lib/aws-s3";
```
2. Now add Bucket as property to interface:
```diff
interface FakeTubeApiProps extends StackProps {
+ bucket: s3.Bucket;
  table: dynamodb.Table;
}
``` 
3. We have to fill the property. Let's get to `bin/fake_tube.ts` and add:
```diff
new FakeTubeApiStack(app, 'FakeTubeApiStack', {
+ bucket: persistentStack.bucket,
  synthesizer: defaultStackSynthesizer,
  table: persistentStack.table,
});
```
4. Now let's create second Lambda function, which would get movie ID as argument and upload miniature to S3. First create the Lambda in CDK - go to file `lib/fake_tube_api-stack.ts` and paste code into class code:
```ts
const miniaturesHandler = new nodejsLambda.NodejsFunction(this, "MiniaturesHandler", {
  runtime: lambda.Runtime.NODEJS_14_X,
  entry: 'resources/miniatures.ts',
  role: iam.Role.fromRoleName(this, "LabRoleMiniatures", "LabRole"),
  environment: {
    S3_BUCKET_NAME: props.bucket.bucketName,
    VIDEOS_TABLE_NAME: props.table.tableName
  },
});
```
4. Let's install AWS-SDK for AWS S3:
```sh
$ npm i @aws-sdk/client-s3 @aws-sdk/util-dynamodb @aws-sdk/lib-storage node-fetch
```
5. Create new file `resources/s3.ts` and add content:
```ts
import { S3Client } from "@aws-sdk/client-s3";

export const getS3Client = () => {
  return new S3Client({});
}

```
6. Add function, which can update DynamoDB item. Move to `lib/repository.ts` and change import at the top:
```diff
- import { ScanCommand, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
+ import { ScanCommand, PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
``` 
7. Change interface and add miniatureUrl to it:
```diff
interface Video {
  id: string;
  title: string;
+ miniatureUrl?: string;
}
```
8. Change `listVideos`, so it can also return `miniatureUrl`:
```diff
return scanResult.Items.map((item) => ({
    id: item.Id,
    title: item.Title,
+   miniatureUrl: item.miniatureUrl ?? "",
}));
```
9. Add function at the bottom of the file:
```ts
export async function updateVideo(Id: string, miniatureUrl: string): Promise<Video> {
  const dynamo = getDynamoClient();

  const result = await dynamo.send(new UpdateCommand({
    ExpressionAttributeValues: {
      ":miniatureUrl": miniatureUrl,
    },
    Key: {
      Id,
    },
    TableName: process.env.VIDEOS_TABLE_NAME,
    UpdateExpression: "SET miniatureUrl = :miniatureUrl",
    ReturnValues: "ALL_NEW",
  }));
  
  return result.Attributes as Video;
}
```
10. Let's create another file `resources/miniatures.ts` with following content:
```ts
import nodeFetch from "node-fetch";

import { Upload } from "@aws-sdk/lib-storage";
import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { DynamoDBStreamEvent, Handler } from 'aws-lambda';

import { getS3Client } from "./s3";
import { updateVideo } from "./repository";


const uploadItemToS3 = async (body: Buffer, key: string): Promise<string> => {
  const upload = new Upload({
    client: getS3Client(),
    params: {
      Body: body,
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
    },
  })

  await upload.done();

  return `https://${process.env.S3_BUCKET_NAME!}.s3.amazonaws.com/${key}`;
};

const getMiniatureAndUpload = async (id: string): Promise<string> => {
  const url = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;

  const fetchResult = await nodeFetch(url);
  const fileContent = await fetchResult.blob();

  return uploadItemToS3(fileContent, `${id}.jpg`);
}

export const handler: Handler<{ id: string }, string> = async (event) => {
  const { id } = event;
  return await getMiniatureAndUpload(id);
}

// export const handler: Handler<
//   DynamoDBStreamEvent,
//   void | string
//   > = async (event) => {
//   const additionEvents = event.Records.filter((record) => record.eventName === "INSERT");
//   await Promise.all(additionEvents.map(async (record) => {
//     const { Id } = unmarshall(record.dynamodb!.NewImage as Record<string, AttributeValue>);
//
//     const uploadedFileUrl = await getMiniatureAndUpload(Id);
//
//     return updateVideo(Id, uploadedFileUrl);
//   }));
// }
```
11. Finally, do the:
```sh
$ cdk deploy FakeTubeApiStack
``` 

## Test
Now let's test the Lambda!

1. Go into AWS Web Console and search for Lambda.
2. Pick `Functions` from left side menu and search for Lambda with prefix `FakeTubeApiStack-MiniaturesHandler`.
3. Go into `Test` tab and paste Event JSON:
```json
{
  "id": "sBbeO5NU7Rk"
}
```
4. Click `Test` button in top right corner.
5. After execution you should see `Execution result: succeeded` - open up the details and copy URL from response and check whether you can see/download the file.

# Exercise 4 - Use Dynamo Stream as input for lambda.

1. Now we will make whole application event driven - go into `resources/miniatures.ts` and do the following changes:
```diff
~// export const handler: Handler<{ id: string }, string> = async (event) => {
~//  const { id } = event;
~//  return await getMiniatureAndUpload(id);
~//}

~export const handler: Handler<
~   DynamoDBStreamEvent,
~   void | string
~   > = async (event) => {
~   const additionEvents = event.Records.filter((record) => record.eventName === "INSERT");
~     await Promise.all(additionEvents.map(async (record) => {
~     const { Id } = unmarshall(record.dynamodb!.NewImage as Record<string, AttributeValue>);
~
~     const uploadedFileUrl = await getMiniatureAndUpload(Id);
~
~     return updateVideo(Id, uploadedFileUrl);
~   }));
~ }
```
<!--
2. Now we have to add DynamoDB stream. Go into `lib/fake_tube_api-stack.ts` and add import:
```ts
import * as lambda_event_sources from "aws-cdk-lib/aws-lambda-event-sources";
```
3. Now add following code after miniatures handler:
```ts
miniaturesHandler.addEventSource(
  new lambda_event_sources.DynamoEventSource(props.table, {
    batchSize: 100,
    bisectBatchOnError: true,
    startingPosition: lambda.StartingPosition.LATEST,
  }),
);
```
-->
3. We need to enable DynamoDB Streams. Go into `lib/fake_tube_persistent-stack.ts` and do the following changes:
```diff
this.table = new dynamodb.Table(this, 'VideoTable', {
  partitionKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
+ stream: dynamodb.StreamViewType.NEW_IMAGE,
});
```
4. Let's do last deploy:
```sh
$ cdk deploy FakeTubeApiStack
``` 
4. Go into AWS Cloud Console - search for Lambda and open MiniaturesHandler lambda.
5. Click `Add trigger`.
6. Pick `DynamoDB` as source.
7. Choose your DynamoDB table from the list and click `Add`.

## Test
Now we should have whole app event driven. Let's try to add movie:

1. Create one video:
```
curl -i -X POST https://<YOUR GW ID>.execute-api.us-east-1.amazonaws.com/prod/videos -d '{"id": "dQw4w9WgXcQ", "title": "Rick Astley - Never Gonna Give You Up (Official Music Video)"}'
```

You should receive `201` status and the body of response should be JSON with you new video.

2. Let's wait ~5-15 seconds.

3. Call our `GET /videos` endpoint

```
curl -i https://<YOUR GW ID>.execute-api.us-east-1.amazonaws.com/prod/videos
```

You should receive list of your videos with previously created item inside and video's miniature.
