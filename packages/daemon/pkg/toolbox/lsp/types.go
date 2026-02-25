package lsp

type LspServerRequest struct {
	LanguageId    string `json:"languageId" validate:"required"`
	PathToProject string `json:"pathToProject" validate:"required"`
} //	@name	LspServerRequest

type LspDocumentRequest struct {
	LanguageId    string `json:"languageId" validate:"required"`
	PathToProject string `json:"pathToProject" validate:"required"`
	Uri           string `json:"uri" validate:"required"`
} //	@name	LspDocumentRequest

type LspCompletionParams struct {
	LanguageId    string             `json:"languageId" validate:"required"`
	PathToProject string             `json:"pathToProject" validate:"required"`
	Uri           string             `json:"uri" validate:"required"`
	Position      LspPosition        `json:"position" validate:"required"`
	Context       *CompletionContext `json:"context,omitempty" validate:"optional"`
} //	@name	LspCompletionParams
