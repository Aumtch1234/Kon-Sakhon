pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/aumtch1234/kon-sakhon.git'
            }
        }

        stage('Build Docker Images') {
            steps {
                sh 'docker compose build'
            }
        }

        stage('Run Containers') {
            steps {
                // ปิด container เก่า แล้วค่อยรันใหม่
                sh 'docker compose down || true'
                sh 'docker compose up -d'
            }
        }

        stage('Test Services') {
            steps {
                sh 'docker ps'
                sh 'curl -f http://localhost:3000 || exit 1'
            }
        }
    }

    post {
        always {
            echo "🧹 Cleaning unused Docker images..."
            sh 'docker image prune -f'
        }
        success {
            echo '🚀 Deployment Success!'
        }
        failure {
            echo '❌ Deployment Failed! Check console output.'
        }
    }
}
