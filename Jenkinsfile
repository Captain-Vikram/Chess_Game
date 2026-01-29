pipeline {
    agent any

    environment {
        // --- CONFIGURATION ---
        DOCKER_HUB_USER = 'captainvikram' 
        IMAGE_NAME      = 'chess-game'
        
        // --- CREDENTIALS ---
        GITHUB_CREDS_ID = 'Captain-Vikram' 
        DOCKER_CREDS_ID = 'Docker-Hub'
    }

    stages {
        // 1. Clean Workspace & Checkout
        stage('Checkout') {
            steps {
                cleanWs()
                git branch: 'testing',
                    credentialsId: "${GITHUB_CREDS_ID}",
                    url: 'https://github.com/Captain-Vikram/Chess_Game.git'
            }
        }

        // 2. Install Dependencies
        stage('Install Dependencies') {
            steps {
                bat 'npm install'
            }
        }

        // 3. SonarQube Analysis
        stage('SonarQube Analysis') {
            steps {
                script {
                    // 1. Get the tool path using the name 'SONAR_RUNNER_HOME'
                    def scannerHome = tool 'SONAR_RUNNER_HOME'
                    
                    // 2. Connect to the server named 'SonarQube' (The one you just saved)
                    withSonarQubeEnv('SonarQube') { 
                        bat "\"${scannerHome}\\bin\\sonar-scanner\" -Dsonar.projectKey=chess-game -Dsonar.sources=src"
                    }
                }
            }
        }

        // 4. Quality Gate
        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // 5. Merge Testing -> Main
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

        // 6. Docker Build & Push
        stage('Docker Build & Push') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: "${DOCKER_CREDS_ID}", passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
                        bat """
                            echo "Logging in to Docker Hub..."
                            docker login -u %DOCKER_USER% -p %DOCKER_PASS%
                            
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
