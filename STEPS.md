# Aim of the lab

We will redesign our application from the last labs - we will add VPC & WAF.

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

# Exercise 1 - Add VPC.

Look for places in code commented as `DO_SOMETHING_EX_1`. 

1. Start with `fake_tube_persistent-stack.ts` file. Create VPC with network CIDR `10.0.0.0/16`. (docs describing how to construct `Vpc` class: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.Vpc.html)
2. Move to `fake_tube_api-stack.ts`. Add previously created Lambda into newly created VPC. (docs describing possible properties of `nodejsLambda.NodejsFunction` constructor: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs.NodejsFunction.html#vpc)
3. Don't forget to do `cdk deploy --all` after/while doing your code changes!
4. Go into the AWS Console and show to your tutor, that Lambda now resides in VPC created by yourself.

# Exercise 2 - Add WAF to your RestApi.

Look for places in code commented as `DO_SOMETHING_EX_2`.

1. First look at the file `fake_tube_api-stack.ts`. There you have to use `WafConstruct` written by me to create WAF.
   1. WAF Construct accept two parameters - `restApi`, which is instance of your RestApi and `rules` - array of WAF rules.
2. Start with creation WAF Construct and pass one rule limiting number of requests per 30 sec: 
```ts
{
  name: "LimitRequests100",
    priority: 1,
    action: {
    block: {
      customResponse: {
        responseCode: 419,
      }
    },
  },
  statement: {
    rateBasedStatement: {
      limit: 100,
        aggregateKeyType: "IP",
    },
  },
  visibilityConfig: {
    sampledRequestsEnabled: true,
      cloudWatchMetricsEnabled: true,
      metricName: "AWSLimitRequests100",
  },
},
```
3. After you created WAF remember to do `cdk deploy --all`!
4. Install `authocannon` with `npm install -g autocannon` to verify that requests for limited.
5. Use command `autocannon -O 100 {url_of_your_videos_endpoint}` to send 100 requests.
6. Try `wget --save-headers --output-document - {url_of_your_videos_endpoint}` - what's the response? 
7. Now based on https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-geo-match.html and second rule, which blocks all traffic from Poland. 
   1. Tip: I suggest trying to copy rule from above and do the changes based on DOCS and intellisense - AWS CDK will HELP YOU with writing proper rule.
8. Try opening `{url_of_your_videos_endpoint}` in your web browser - what's the response?
9. Also take a look at your WAF in AWS Console - what can you see there in the Metrics? 
