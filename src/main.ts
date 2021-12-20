import * as core from '@actions/core'
import * as github from '@actions/github'
import * as xlsx from 'xlsx'
import {Octokit} from '@octokit/rest'
import {graphql} from '@octokit/graphql'

async function run(): Promise<void> {
  try {
    //fetch data using octokit api
    const octokit = new Octokit({
      auth: core.getInput('token')
    })
    const context = github.context
    const login: string = context.payload?.repository?.owner.login!
    const repoName: string = context.payload?.repository?.name!
    //get the code scanning report for repo and save as alerts.xlsx
    const csIssues: string[][] = await getCodeScanningReport(
      login,
      repoName,
      octokit
    )
    const dgInfo: string[][] = await getDependencyGraphReport(login, repoName)

    //create an excel file with the data
    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.aoa_to_sheet(csIssues)
    const ws1 = xlsx.utils.aoa_to_sheet(dgInfo)
    xlsx.utils.book_append_sheet(wb, ws, 'code-scanning-issues')
    xlsx.utils.book_append_sheet(wb, ws1, 'dependencies-list')
    xlsx.writeFile(wb, 'alerts.xlsx')
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()

async function getCodeScanningReport(
  login: string,
  repoName: string,
  octokit: Octokit
): Promise<string[][]> {
  const data = await octokit.paginate(
    octokit.rest.codeScanning.listAlertsForRepo,
    {
      owner: login,
      repo: repoName
    }
  )

  // create a array of objects with the data
  const csvData: string[][] = []
  const header: string[] = [
    'toolName',
    'alertNumber',
    'htmlUrl',
    'state',
    'rule',
    'severity'
  ]

  csvData.push(header)
  //iterate over the data and print the alert information
  for (const alert of data) {
    core.debug(`${alert.tool.name}[${alert.number}]: \
      ${alert.state} \
      ${alert.rule.id} \
      ${alert.rule.severity}`)

    //create an array of string values
    const row: string[] = [
      alert.tool.name!,
      alert.number.toString(),
      alert.html_url,
      alert.state,
      alert.rule.id!,
      alert.rule.severity!
    ]

    csvData.push(row)
  }

  return csvData
}
async function getDependencyGraphReport(
  login: string,
  repoName: string
): Promise<string[][]> {
  const {repository} = await graphql(
    `
      {
        repository(owner: "${login}", name: "${repoName}") {
          name
          licenseInfo {
            name
          }
          dependencyGraphManifests {
            totalCount
            edges {
              node {
                filename
                dependencies {
                  edges {
                    node {
                      packageName
                      packageManager
                      requirements
                      repository {
                        licenseInfo {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    {
      headers: {
        authorization: `token ${core.getInput('token')}`,
        accept: 'application/vnd.github.hawkgirl-preview+json'
      }
    }
  )

  const csvData: string[][] = []
  const header: string[] = [
    'manifest',
    'packageName',
    'packageManager',
    'requirements',
    'licenseInfo'
  ]

  csvData.push(header)
  for (const dependency of repository.dependencyGraphManifests.edges) {
    for (const dependencyEdge of dependency.node.dependencies.edges) {
      //console.log(JSON.stringify(dependencyEdge.node, null, 2))
      let licenseInfo = ''
      if (
        dependencyEdge.node &&
        dependencyEdge.node.repository &&
        dependencyEdge.node.repository.licenseInfo
      ) {
        licenseInfo = dependencyEdge.node.repository.licenseInfo.name
      }
      const row: string[] = [
        dependency.node.filename,
        dependencyEdge.node.packageName,
        dependencyEdge.node.packageManager,
        dependencyEdge.node.requirements,
        licenseInfo
      ]

      csvData.push(row)
    }
  }
  return csvData
}
