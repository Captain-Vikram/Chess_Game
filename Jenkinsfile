pipeline {
    agent any

    environment {
        // --- CONFIGURATION ---
        DOCKER_HUB_USER = 'captainvikram' 
        IMAGE_NAME      = 'chess-game'
        
        // --- CREDENTIAL IDs ---
        // 1. GitHub Token ID (From your earlier screenshot)
        GITHUB_CREDS_ID = 'Captain-Vikram' 
        
        // 2. SonarQube Token ID (From your earlier screenshot)
        SONAR_TOKEN_ID  = 'sonar qube auth token'
        
        // 3. Docker Hub ID (The one you just created)
        DOCKER_CREDS_ID = 'Docker-Hub'
    }

    stages {
        // 1. Clean Workspace & Checkout
        stage('Checkout') {
            steps {
                cleanWs()
                // Explicitly checkout the 'testing' branch
                git branch: 'testing',
                    credentialsId: "${GITHUB_CREDS_ID}",
                    url: 'https://github.com/Captain-Vikram/Chess_Game.git'
            }
        }

        // 2. Install Dependencies
        stage('Install Dependencies') {
            steps {
                // Installs node modules for SonarQube analysis
                bat 'npm install'
            }
        }

        // 3. SonarQube Analysis
        stage('SonarQube Analysis') {
            steps {
                // IMPORTANT: Ensure your Global Tool Configuration tool is named 'SonarQube Scanner'
                withSonarQubeEnv('SonarQube Scanner') { 
                    bat "sonar-scanner -Dsonar.projectKey=chess-game -Dsonar.sources=src -Dsonar.host.url=http://localhost:9000 -Dsonar.login=%SONAR_AUTH_TOKEN%"
                }
            }
        }

        // 4. Quality Gate
        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    // Aborts pipeline if Quality Gate fails
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // 5. Merge Testing -> Main (Runs only if Quality Gate passed)
        stage('Merge to Main') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: "${GITHUB_CREDS_ID}", passwordVariable: 'GIT_TOKEN', usernameVariable: 'GIT_USER')]) {
                        bat """
                            echo "Quality Gate Passed. Merging to Main..."
                            
                            git config user.email "jenkins@bot.com"
                            git config user.name "Jenkins Bot"
                            
                            REM Fetch all branches
                            git fetch origin main:main
                            
                            REM Checkout main and merge testing
                            git checkout main
                            git merge testing
                            
                            REM Push to GitHub using the Token
                            git push https://%GIT_TOKEN%@github.com/Captain-Vikram/Chess_Game.git main
                        """
                    }
                }
            }
        }

        // 6. Build & Push Docker Image
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
