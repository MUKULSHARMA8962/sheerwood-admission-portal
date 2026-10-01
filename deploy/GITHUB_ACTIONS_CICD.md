# GitHub Actions CI/CD

The workflows in `.github/workflows` run automatically:

- **Continuous Integration** runs the frontend production build and both backend workflow tests on every pull request and every push to `main`.
- **Deploy Production** deploys `main` to the existing Ubuntu Docker Compose server only after the CI workflow succeeds. It can also be started manually from GitHub's **Actions** tab.

## One-time server setup

Use the existing Docker deployment instructions in the main README first. On the production server, the repository must be cloned at a stable path such as `/home/ubuntu/sheerwood-admission-portal`, with these server-only files already present:

- `.env.production`
- `backend/.env`

They are intentionally ignored by Git and are never replaced by CI/CD. The deployment user needs permission to run Docker without an interactive password. For an Ubuntu user named `ubuntu`:

```bash
sudo usermod -aG docker ubuntu
```

Sign out and sign in again after running that command. If the GitHub repository is private, configure a read-only deploy key on the server so `git pull origin main` can authenticate.

## GitHub production secrets

In GitHub, open **Settings → Environments → production** and add these environment secrets:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | Production server IP address or hostname |
| `DEPLOY_USER` | SSH deployment user, for example `ubuntu` |
| `DEPLOY_PATH` | Absolute repository path, for example `/home/ubuntu/sheerwood-admission-portal` |
| `DEPLOY_SSH_KEY` | Private SSH key for the deployment user |
| `DEPLOY_KNOWN_HOSTS` | Trusted host key, generated from a trusted machine with `ssh-keyscan -H YOUR_SERVER` |

Do not store Cognito, SES, database, Easebuzz, or SMTP secrets in GitHub Actions. Keep them in the server's ignored `.env.production` and `backend/.env` files.

You can configure required reviewers for the `production` environment if deployments should require approval before GitHub connects to the server.
