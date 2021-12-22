import * as core from '@actions/core'
import * as github from '@actions/github'
import * as xlsx from 'xlsx'
import {Octokit} from '@octokit/rest' //import to call rest api
import {graphql} from '@octokit/graphql' //import to call graphql api

async function run(): Promise<void> {
  try {
    //fetch data using octokit api
    const octokit = new Octokit({
      auth: core.getInput('token') //get the token from the action inputs.
    })
    const context = github.context //find the repo and owner from the github context
    let login: string = context.payload?.repository?.owner.login!
    let repoName: string = context.payload?.repository?.name!

    if (!login || !repoName) {
      //code to enable running on a local machine without a github context
      //set the INPUT_TOKEN and GITHUB_REPOSITORY (to login/reponame) env variables
      core.error('No login found, using GITHUB_REPOSITORY')
      const repo = process.env.GITHUB_REPOSITORY!
      login = repo.split('/')[0]
      repoName = repo.split('/')[1]
    }

    //get the code scanning report for repo.
    const csIssues: string[][] = await getCodeScanningReport(
      login,
      repoName,
      octokit
    )

    //get the dependency graph report for repo.
    const dgInfo: string[][] = await getDependencyGraphReport(login, repoName)

    //create an excel file with the dataset
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
  //the paginatte API will fecth all records (100 at a time).
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
  //get the dependency graph for the repo and parse the data
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
      let licenseInfo = ''
      if ( //null checks in case a dependency has no license info
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
