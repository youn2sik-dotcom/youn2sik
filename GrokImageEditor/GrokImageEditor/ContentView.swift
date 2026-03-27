import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = ImageEditorViewModel()
    @State private var showImagePicker = false
    @State private var showAlert = false
    @State private var showSaveConfirmation = false

    var body: some View {
        NavigationStack {
            ZStack {
                ScrollView {
                    VStack(spacing: 20) {
                        // MARK: - Source Image Section
                        sourceImageSection

                        // MARK: - Prompt Input
                        promptSection

                        // MARK: - Action Buttons
                        actionButtons

                        // MARK: - Result Image Section
                        if let editedImage = viewModel.editedImage {
                            resultImageSection(image: editedImage)
                        }
                    }
                    .padding()
                }

                // MARK: - Loading Overlay
                if viewModel.isLoading {
                    loadingOverlay
                }
            }
            .navigationTitle("Grok Image Editor")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    NavigationLink(destination: SettingsView(apiKey: $viewModel.apiKey)) {
                        Image(systemName: "gearshape.fill")
                            .foregroundColor(.primary)
                    }
                }
            }
            .sheet(isPresented: $showImagePicker) {
                ImagePickerView(selectedImage: $viewModel.selectedImage)
            }
            .alert("알림", isPresented: $showAlert) {
                Button("확인", role: .cancel) {
                    viewModel.errorMessage = nil
                }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
            .alert("저장 완료", isPresented: $showSaveConfirmation) {
                Button("확인", role: .cancel) {}
            } message: {
                Text("이미지가 사진 라이브러리에 저장되었습니다.")
            }
            .onChange(of: viewModel.errorMessage) { _, newValue in
                if newValue != nil {
                    showAlert = true
                }
            }
        }
    }

    // MARK: - Source Image Section

    private var sourceImageSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("원본 이미지", systemImage: "photo.on.rectangle")
                .font(.headline)
                .foregroundColor(.primary)

            Button {
                showImagePicker = true
            } label: {
                if let selectedImage = viewModel.selectedImage {
                    Image(uiImage: selectedImage)
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 250)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
                        )
                } else {
                    VStack(spacing: 12) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 40))
                            .foregroundColor(.accentColor)
                        Text("이미지를 선택하려면 탭하세요")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 180)
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(style: StrokeStyle(lineWidth: 2, dash: [8]))
                            .foregroundColor(.secondary.opacity(0.4))
                    )
                }
            }
        }
    }

    // MARK: - Prompt Section

    private var promptSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("프롬프트", systemImage: "text.cursor")
                .font(.headline)
                .foregroundColor(.primary)

            TextField("이미지 편집 지시사항을 입력하세요", text: $viewModel.prompt, axis: .vertical)
                .lineLimit(3...6)
                .textFieldStyle(.plain)
                .padding(12)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        HStack(spacing: 12) {
            Button {
                viewModel.editImage()
            } label: {
                Label("이미지 편집", systemImage: "wand.and.stars")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .tint(.blue)
            .disabled(viewModel.selectedImage == nil || viewModel.prompt.isEmpty || viewModel.isLoading)

            Button {
                viewModel.generateImage()
            } label: {
                Label("이미지 생성", systemImage: "sparkles")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .tint(.purple)
            .disabled(viewModel.prompt.isEmpty || viewModel.isLoading)
        }
    }

    // MARK: - Result Image Section

    private func resultImageSection(image: UIImage) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("결과 이미지", systemImage: "photo.artframe")
                    .font(.headline)
                    .foregroundColor(.primary)

                Spacer()

                Button {
                    viewModel.saveEditedImage()
                    showSaveConfirmation = true
                } label: {
                    Label("저장", systemImage: "square.and.arrow.down")
                        .font(.subheadline.bold())
                }
                .buttonStyle(.bordered)
                .tint(.green)
            }

            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)
        }
    }

    // MARK: - Loading Overlay

    private var loadingOverlay: some View {
        ZStack {
            Color.black.opacity(0.4)
                .ignoresSafeArea()

            VStack(spacing: 16) {
                ProgressView()
                    .scaleEffect(1.5)
                    .tint(.white)

                Text("처리 중...")
                    .font(.headline)
                    .foregroundColor(.white)

                Text("잠시만 기다려주세요")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.8))
            }
            .padding(32)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 20))
        }
    }
}

#Preview {
    ContentView()
}
