import Foundation
import UIKit
import Photos

@MainActor
class ImageEditorViewModel: ObservableObject {
    @Published var selectedImage: UIImage?
    @Published var editedImage: UIImage?
    @Published var prompt: String = ""
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var apiKey: String = "" {
        didSet {
            UserDefaults.standard.set(apiKey, forKey: apiKeyStorageKey)
        }
    }

    private let apiService = GrokAPIService()
    private let apiKeyStorageKey = "com.grokimageeditor.apiKey"

    init() {
        self.apiKey = UserDefaults.standard.string(forKey: apiKeyStorageKey) ?? ""
    }

    // MARK: - Edit Image

    func editImage() {
        guard let image = selectedImage else {
            errorMessage = "편집할 이미지를 먼저 선택해주세요."
            return
        }

        guard !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "편집 지시사항을 입력해주세요."
            return
        }

        guard !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "설정에서 API 키를 먼저 입력해주세요."
            return
        }

        isLoading = true
        errorMessage = nil

        Task {
            do {
                let result = try await apiService.editImage(
                    apiKey: apiKey.trimmingCharacters(in: .whitespacesAndNewlines),
                    image: image,
                    prompt: prompt
                )
                self.editedImage = result
            } catch {
                self.errorMessage = error.localizedDescription
            }
            self.isLoading = false
        }
    }

    // MARK: - Generate Image

    func generateImage() {
        guard !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "이미지 생성을 위한 프롬프트를 입력해주세요."
            return
        }

        guard !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "설정에서 API 키를 먼저 입력해주세요."
            return
        }

        isLoading = true
        errorMessage = nil

        Task {
            do {
                let result = try await apiService.generateImage(
                    apiKey: apiKey.trimmingCharacters(in: .whitespacesAndNewlines),
                    prompt: prompt
                )
                self.editedImage = result
            } catch {
                self.errorMessage = error.localizedDescription
            }
            self.isLoading = false
        }
    }

    // MARK: - Save Image

    func saveEditedImage() {
        guard let image = editedImage else {
            errorMessage = "저장할 이미지가 없습니다."
            return
        }

        PHPhotoLibrary.requestAuthorization(for: .addOnly) { [weak self] status in
            DispatchQueue.main.async {
                switch status {
                case .authorized, .limited:
                    UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
                    self?.errorMessage = nil
                case .denied, .restricted:
                    self?.errorMessage = "사진 라이브러리 접근 권한이 필요합니다. 설정에서 권한을 허용해주세요."
                case .notDetermined:
                    self?.errorMessage = "사진 라이브러리 접근 권한을 요청할 수 없습니다."
                @unknown default:
                    self?.errorMessage = "알 수 없는 권한 상태입니다."
                }
            }
        }
    }
}
