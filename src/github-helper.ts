import * as github from '@actions/github'
import * as core from '@actions/core'

const ERROR_PR_REVIEW_FROM_AUTHOR =
  'Review cannot be requested from pull request author'

export interface Inputs {
  token: string
  committer: string
  author: string
  branch: string
  labels: string[]
  assignees: string[]
  reviewers: string[]
  teamReviewers: string[]
}

export async function createPullRequest(
  inputs: Inputs,
  prBranch: string
): Promise<void> {
  const octokit = github.getOctokit(inputs.token)
  if (process.env.GITHUB_REPOSITORY !== undefined) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')

    // Get PR title
    const title =
      github.context.payload &&
      github.context.payload.pull_request &&
      github.context.payload.pull_request.title
    core.info(`Using body '${title}'`)

    // Get HEAD SHA
    const sha =
      github.context.payload &&
      github.context.payload.pull_request &&
      github.context.payload.pull_request.head &&
      github.context.payload.pull_request.head.sha
    core.info(`Using sha '${sha}'`)
    // Get PR body
    const body =
      github.context.payload &&
      github.context.payload.pull_request &&
      github.context.payload.pull_request.body
    core.info(`Using body '${body}'`)
    const mod_body = 'Cherrypick of commit: ' + sha + '\n\n' + body
    const mod_title = '[' + inputs.branch + '] ' + title
    // Create PR
    const pull = await octokit.pulls.create({
      owner,
      repo,
      title: mod_title,
      head: prBranch,
      base: inputs.branch,
      body: mod_body
    })

    // Apply labels
    if (inputs.labels.length > 0) {
      core.info(`Applying labels '${inputs.labels}'`)
      await octokit.issues.addLabels({
        owner,
        repo,
        issue_number: pull.data.number,
        labels: inputs.labels
      })
    }

    // Apply assignees
    if (inputs.assignees.length > 0) {
      core.info(`Applying assignees '${inputs.assignees}'`)
      await octokit.issues.addAssignees({
        owner,
        repo,
        issue_number: pull.data.number,
        assignees: inputs.assignees
      })
    }

    // Request reviewers and team reviewers
    try {
      if (inputs.reviewers.length > 0) {
        core.info(`Requesting reviewers '${inputs.reviewers}'`)
        await octokit.pulls.requestReviewers({
          owner,
          repo,
          pull_number: pull.data.number,
          reviewers: inputs.reviewers
        })
      }
      if (inputs.teamReviewers.length > 0) {
        core.info(`Requesting team reviewers '${inputs.teamReviewers}'`)
        await octokit.pulls.requestReviewers({
          owner,
          repo,
          pull_number: pull.data.number,
          team_reviewers: inputs.teamReviewers
        })
      }
    } catch (e) {
      if (e.message && e.message.includes(ERROR_PR_REVIEW_FROM_AUTHOR)) {
        core.warning(ERROR_PR_REVIEW_FROM_AUTHOR)
      } else {
        throw e
      }
    }
  }
}
