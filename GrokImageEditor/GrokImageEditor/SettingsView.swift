import SwiftUI

struct SettingsView: View {
    @Binding var apiKey: String
    @State private var tempAPIKey: String = ""
    @State private var showSaveConfirmation = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            // MARK: - API Key Section
            Section {
                SecureField("xAI API 키를 입력하세요", text: $tempAPIKey)
                    .textContentType(.password)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)

                Button {
                    apiKey = tempAPIKey
                    showSaveConfirmation = true
                } label: {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                        Text("API 키 저장")
                    }
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.blue)
                .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
            } header: {
                Label("API 키 설정", systemImage: "key.fill")
            } footer: {
                Text("API 키는 기기에 안전하게 저장됩니다.")
                    .font(.caption)
            }

            // MARK: - Instructions Section
            Section {
                VStack(alignment: .leading, spacing: 12) {
                    instructionRow(
                        number: "1",
                        text: "xAI 콘솔에 접속합니다."
                    )
                    instructionRow(
                        number: "2",
                        text: "계정에 로그인하거나 새 계정을 만듭니다."
                    )
                    instructionRow(
                        number: "3",
                        text: "API Keys 메뉴에서 새 API 키를 생성합니다."
                    )
                    instructionRow(
                        number: "4",
                        text: "생성된 키를 복사하여 위 입력란에 붙여넣습니다."
                    )
                }
                .padding(.vertical, 4)

                HStack(spacing: 6) {
                    Image(systemName: "globe")
                        .foregroundColor(.accentColor)
                    Text("console.x.ai")
                        .foregroundColor(.accentColor)
                        .underline()
                    Text("에서 API 키를 발급받으세요.")
                        .foregroundColor(.secondary)
                }
                .font(.subheadline)
                .padding(.vertical, 4)
            } header: {
                Label("API 키 발급 방법", systemImage: "questionmark.circle.fill")
            }

            // MARK: - Info Section
            Section {
                HStack(spacing: 12) {
                    Image(systemName: "info.circle.fill")
                        .foregroundColor(.blue)
                        .font(.title3)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Grok Image Editor")
                            .font(.subheadline.bold())
                        Text("xAI의 Grok-2 Image 모델을 사용하여 이미지를 편집하고 생성합니다.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("앱 정보", systemImage: "app.badge.fill")
            }
        }
        .navigationTitle("설정")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            tempAPIKey = apiKey
        }
        .alert("저장 완료", isPresented: $showSaveConfirmation) {
            Button("확인", role: .cancel) {}
        } message: {
            Text("API 키가 저장되었습니다.")
        }
    }

    private func instructionRow(number: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(number)
                .font(.caption.bold())
                .foregroundColor(.white)
                .frame(width: 22, height: 22)
                .background(Circle().fill(Color.accentColor))

            Text(text)
                .font(.subheadline)
                .foregroundColor(.primary)
        }
    }
}

#Preview {
    NavigationStack {
        SettingsView(apiKey: .constant(""))
    }
}
