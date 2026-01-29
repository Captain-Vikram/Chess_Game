pipeline {
    agent any

    environment {
        // --- CONFIGURATION ---
        // UPDATED: Added '09' to match your real Docker Hub username
        DOCKER_HUB_USER = 'captainvikram09' 
        IMAGE_NAME      = 'chess-game'
        
        // --- CREDENTIALS ---
        GITHUB_CREDS_ID = 'github-login' 
        DOCKER_CREDS_ID = 'Docker-Hub'
    }

    stages {
        stage('Checkout') {
            steps {
                cleanWs()
                git branch: 'testing',
                    credentialsId: "${GITHUB_CREDS_ID}",
                    url: 'https://github.com/Captain-Vikram/Chess_Game.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm install'
            }
        }

        stage('SonarQube Analysis') {
            steps {
                script {
                    def scannerHome = tool 'SonarScanner'
                    withSonarQubeEnv('SonarQube') { 
                        bat "\"${scannerHome}\\bin\\sonar-scanner\" -Dsonar.projectKey=chess-game -Dsonar.sources=src"
                    }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Merge to Main') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: "${GITHUB_CREDS_ID}", passwordVariable: 'GIT_TOKEN', usernameVariable: 'GIT_USER')]) {
                        bat """
                            echo "Quality Gate Passed. Merging to Main..."
                            git config user.email "jenkins@bot.com"
                            git config user.name "Jenkins Bot"
                            
                            git fetch origin main:main
                            git checkout main
                            git merge testing
                            git push https://%GIT_TOKEN%@github.com/Captain-Vikram/Chess_Game.git main
                        """
                    }
                }
            }
        }

        stage('Docker Build & Push') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: "${DOCKER_CREDS_ID}", passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
                        bat """
                            echo "Logging in to Docker Hub..."
                            @REM Safe login using stdin to handle special characters in tokens
                            echo %DOCKER_PASS% | docker login -u %DOCKER_USER% --password-stdin
                            
                            echo "Building Image..."
                            docker build -t %DOCKER_USER%/%IMAGE_NAME%:%BUILD_NUMBER% .
                            
                            echo "Pushing Image..."
                            docker push %DOCKER_USER%/%IMAGE_NAME%:%BUILD_NUMBER%
                            
                            echo "Tagging as Latest..."
                            docker tag %DOCKER_USER%/%IMAGE_NAME%:%BUILD_NUMBER% %DOCKER_USER%/%IMAGE_NAME%:latest
                            docker push %DOCKER_USER%/%IMAGE_NAME%:latest
                        """
                    }
                }
            }
        }
    }
}
