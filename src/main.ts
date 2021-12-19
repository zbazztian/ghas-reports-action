import * as core from '@actions/core'
import * as github from '@actions/github'
import * as xlsx from 'xlsx'
import {Octokit} from '@octokit/rest'

async function run(): Promise<void> {
  try {
    //fetch data using octokit api
    const context = github.context
    const login: string = context.payload?.repository?.owner.login!
    const repoName: string = context.payload?.repository?.name!
    //get the code scanning report for repo and save as alerts.xlsx
    await getCodeScanningReport(login, repoName)

    //fetch graphql data using octokit api
    const octokit = new Octokit({
      auth: core.getInput('token')
    })
    const {data} = await octokit.graphql(
      `query {
        repository(owner: "${login}", name: "${repoName}") {
          name
          pullRequests(last: 100, states: OPEN) {
            edges {
              node {
                title
                number
                url
                commits(last: 1) {
                  edges {
                    node {
                      commit {
                        oid
                        message
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`
    )

    //print data to core.debug
    for (const pr of data.repository.pullRequests.edges) {
      core.debug(JSON.stringify(pr.node))
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()

async function getCodeScanningReport(
  login: string,
  repoName: string
): Promise<void> {
  const octokit = new Octokit({
    auth: core.getInput('token')
  })
  const {data} = await octokit.rest.codeScanning.listAlertsForRepo({
    owner: login,
    repo: repoName
  })

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

  //create an excel file with the data
  const wb = xlsx.utils.book_new()
  const ws = xlsx.utils.aoa_to_sheet(csvData)
  xlsx.utils.book_append_sheet(wb, ws, 'code-scanning-issues')
  xlsx.writeFile(wb, 'alerts.xlsx')
}
