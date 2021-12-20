
This action is written to demonstrate the use of xlsx package and github api to generate a fast excel report (alerts.xlsx) for code-scanning issues and dependencies  (including license) information available within the repository issues and dependencies (dependency graph) api.

![Screenshot 2021-12-20 at 12 32 22 AM](https://user-images.githubusercontent.com/23517709/146687440-20259d95-3a6a-4d03-8cf0-4fb401414b41.png)

#### dependencies-list sheet
<img width="863" alt="Screenshot 2021-12-20 at 12 26 16 AM" src="https://user-images.githubusercontent.com/23517709/146687357-062d7710-d33a-4987-9974-0c0c3a364602.png">

#### code-scanning-issues sheet
<img width="717" alt="Screenshot 2021-12-20 at 12 26 38 AM" src="https://user-images.githubusercontent.com/23517709/146687360-b04a651f-6e06-4b40-8b0a-d436e50c68b4.png">


## Using to the Action

The action require a github personal access token passed in the workflow file. The correct way to do this is to use repository secrets.

The action creates alert.xlsx file in the workspace, which needs to be uploaded using the upload-artifact action.

      # Generate issues and save results
      - uses: amitgupta7/ghas-reports-action@v2
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/upload-artifact@v2
        with:
          name: results
          path: alerts.xlsx          

## Code in Main

> First, you'll need to have a reasonably modern version of `node` handy. This won't work with versions older than 9, for instance.

Install the dependencies  
```bash
$ npm install
```

Build the typescript and package it for distribution
```bash
$ npm run build && npm run package
```

Run the tests (Not working at the moment)
```bash
$ npm test

 
    Command failed: node ./lib/main.js

      12 |     env: process.env
      13 |   }
    > 14 |   console.log(cp.execFileSync(np, [ip], options).toString())
         |                  ^
      15 | })
      16 |

      at Object.<anonymous> (__tests__/main.test.ts:14:18)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
Snapshots:   0 total
Time:        1.524 s, estimated 2 s

...
```

## Publish to a distribution branch

Actions are run from Public GitHub repos so we will checkin the packed dist folder. 

Then run [ncc](https://github.com/zeit/ncc) and push the results:
```bash
$ npm run package
$ git add dist
$ git commit -a -m "prod dependencies"
$ git push origin releases/v1
```

Note: We recommend using the `--license` option for ncc, which will create a license file for all of the production node modules used in your project.

Your action is now published! :rocket: 

See the [versioning documentation](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)
