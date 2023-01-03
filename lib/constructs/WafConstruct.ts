import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as aws_wafv2 from "aws-cdk-lib/aws-wafv2";

import { Construct } from "constructs";

interface WafProps {
  /**
   * Instance of RestApi, which should be hidden behind WAF
   */
  restApi: apigateway.IRestApi;
  /**
   * The rule statements used to identify the web requests that you want to allow, block, or count. Each rule includes one top-level statement that AWS WAF uses to identify matching web requests, and parameters that govern how AWS WAF handles them.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-wafv2-rulegroup.html#cfn-wafv2-rulegroup-rules
   */
  rules: Array<aws_wafv2.CfnWebACL.RuleProperty>;
}

export class WafConstruct extends Construct {
  constructor(scope: Construct, id: string, { restApi, rules }: WafProps) {
    super(scope, id);

    this.node.addDependency(restApi);

    const wafSettings = new aws_wafv2.CfnWebACL(
      this,
      "WebApplicationFirewallSettings",
      {
        description: "ACL for RestAPI",
        scope: "REGIONAL",
        defaultAction: { allow: {} },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: "firewall",
        },
        rules,
      }
    );

    // ========================================================================
    // Resource: AWS WAF - Web Application Firewall
    // ========================================================================

    // Purpose: Associate AWS WAF with AWS AppSync
    new aws_wafv2.CfnWebACLAssociation(
      this,
      "AppSyncAclAssociation",
      {
        resourceArn: restApi.deploymentStage.stageArn,
        webAclArn: wafSettings.attrArn,
      }
    );
  }
}
