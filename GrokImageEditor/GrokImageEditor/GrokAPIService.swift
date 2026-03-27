import Foundation
import UIKit

enum GrokAPIError: LocalizedError {
    case invalidAPIKey
    case imageConversionFailed
    case invalidResponse
    case httpError(statusCode: Int, message: String)
    case noImageInResponse
    case imageDownloadFailed
    case networkError(String)

    var errorDescription: String? {
        switch self {
        case .invalidAPIKey:
            return "API 키가 설정되지 않았습니다. 설정에서 xAI API 키를 입력해주세요."
        case .imageConversionFailed:
            return "이미지를 JPEG 형식으로 변환하는데 실패했습니다."
        case .invalidResponse:
            return "서버로부터 유효하지 않은 응답을 받았습니다."
        case .httpError(let statusCode, let message):
            return "HTTP 오류 (\(statusCode)): \(message)"
        case .noImageInResponse:
            return "응답에서 편집된 이미지를 찾을 수 없습니다."
        case .imageDownloadFailed:
            return "편집된 이미지를 다운로드하는데 실패했습니다."
        case .networkError(let message):
            return "네트워크 오류: \(message)"
        }
    }
}

class GrokAPIService {
    private let baseURL = "https://api.x.ai/v1"
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    // MARK: - Image Editing

    /// Edit an existing image using a text prompt.
    func editImage(apiKey: String, image: UIImage, prompt: String) async throws -> UIImage {
        guard !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw GrokAPIError.invalidAPIKey
        }

        guard let jpegData = image.jpegData(compressionQuality: 0.8) else {
            throw GrokAPIError.imageConversionFailed
        }

        let base64String = jpegData.base64EncodedString()
        let dataURL = "data:image/jpeg;base64,\(base64String)"

        let requestBody: [String: Any] = [
            "model": "grok-2-image",
            "messages": [
                [
                    "role": "user",
                    "content": [
                        [
                            "type": "text",
                            "text": "Edit this image: \(prompt)"
                        ],
                        [
                            "type": "image_url",
                            "image_url": [
                                "url": dataURL
                            ]
                        ]
                    ]
                ]
            ]
        ]

        return try await performRequest(apiKey: apiKey, body: requestBody)
    }

    // MARK: - Image Generation

    /// Generate a new image from a text prompt only (no input image).
    func generateImage(apiKey: String, prompt: String) async throws -> UIImage {
        guard !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw GrokAPIError.invalidAPIKey
        }

        let requestBody: [String: Any] = [
            "model": "grok-2-image",
            "messages": [
                [
                    "role": "user",
                    "content": prompt
                ]
            ]
        ]

        return try await performRequest(apiKey: apiKey, body: requestBody)
    }

    // MARK: - Private Helpers

    private func performRequest(apiKey: String, body: [String: Any]) async throws -> UIImage {
        let url = URL(string: "\(baseURL)/chat/completions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")

        let jsonData = try JSONSerialization.data(withJSONObject: body)
        request.httpBody = jsonData

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw GrokAPIError.networkError(error.localizedDescription)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw GrokAPIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = parseErrorMessage(from: data) ?? "알 수 없는 오류"
            throw GrokAPIError.httpError(statusCode: httpResponse.statusCode, message: errorMessage)
        }

        let imageURL = try extractImageURL(from: data)
        return try await downloadImage(from: imageURL)
    }

    private func parseErrorMessage(from data: Data) -> String? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let error = json["error"] as? [String: Any],
              let message = error["message"] as? String else {
            return String(data: data, encoding: .utf8)
        }
        return message
    }

    private func extractImageURL(from data: Data) throws -> URL {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let choices = json["choices"] as? [[String: Any]],
              let firstChoice = choices.first,
              let message = firstChoice["message"] as? [String: Any],
              let content = message["content"] as? [[String: Any]] else {
            // Try parsing content as a string (fallback)
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let choices = json["choices"] as? [[String: Any]],
               let firstChoice = choices.first,
               let message = firstChoice["message"] as? [String: Any],
               let contentString = message["content"] as? String,
               let url = URL(string: contentString) {
                return url
            }
            throw GrokAPIError.noImageInResponse
        }

        // Look for image_url type in content blocks
        for block in content {
            if let type = block["type"] as? String, type == "image_url",
               let imageURL = block["image_url"] as? [String: Any],
               let urlString = imageURL["url"] as? String,
               let url = URL(string: urlString) {
                return url
            }
        }

        throw GrokAPIError.noImageInResponse
    }

    private func downloadImage(from url: URL) async throws -> UIImage {
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(from: url)
        } catch {
            throw GrokAPIError.imageDownloadFailed
        }

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw GrokAPIError.imageDownloadFailed
        }

        guard let image = UIImage(data: data) else {
            throw GrokAPIError.imageDownloadFailed
        }

        return image
    }
}
