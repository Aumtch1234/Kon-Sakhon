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
                sh 'docker-compose build'
            }
        }

        stage('Run Containers') {
            steps {
                sh 'docker-compose up -d'
            }
        }

        stage('Test Services') {
            steps {
                sh 'docker ps'
                sh 'curl -f http://localhost:3000 || exit 1' // ตรวจสอบว่า Next.js รัน
            }
        }

        stage('Clean Up') {
            steps {
                sh 'docker system prune -f'
            }
        }
    }

    post {
        success {
            echo '🚀 Deployment Success!'
        }
        failure {
            echo '❌ Deployment Failed!'
        }
    }
}
