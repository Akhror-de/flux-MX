terraform {
  required_providers {
    yandex = {
      source = "yandex-cloud/yandex"
    }
  }
}

provider "yandex" {
  zone = "ru-central1-a"
}

# Сервисный аккаунт
resource "yandex_iam_service_account" "flux-sa" {
  name        = "flux-service-account"
  description = "Service account for Flux PWA"
  folder_id   = var.folder_id
}

# Object Storage для аудио
resource "yandex_storage_bucket" "audio-storage" {
  bucket     = "flux-audio-storage-${random_id.bucket_suffix.hex}"
  acl        = "private"
  folder_id  = var.folder_id
  
  website {
    index_document = "index.html"
  }
}

# Cloud Function для анализа BPM
resource "yandex_function" "analyze-bpm" {
  name               = "analyze-bpm"
  runtime            = "nodejs16"
  entrypoint         = "index.handler"
  memory             = "128"
  execution_timeout  = "10"
  service_account_id = yandex_iam_service_account.flux-sa.id
  folder_id          = var.folder_id
  
  environment = {
    BUCKET_NAME = yandex_storage_bucket.audio-storage.bucket
  }
  
  content {
    zip_filename = "${path.module}/../functions/analyze-bpm/function.zip"
  }
}

# Random ID для bucket
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

output "bucket_name" {
  value = yandex_storage_bucket.audio-storage.bucket
}

output "function_url" {
  value = "https://functions.yandexcloud.net/${yandex_function.analyze-bpm.id}"
}
