package api

import (
	"fmt"
	"html/template"
	"io/fs"
	"net/http"
)

var Templates *template.Template

// InitTemplates parses templates from the provided filesystem
func InitTemplates(embedFS fs.FS) error {
	var err error
	// Parses all html templates inside templates/ and subdirectories
	Templates, err = template.ParseFS(embedFS, "templates/*.html")
	if err != nil {
		return fmt.Errorf("failed to parse embedded templates: %w", err)
	}
	return nil
}

// RenderTemplate renders the layout with the active page content
func RenderTemplate(w http.ResponseWriter, name string, data interface{}) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	// Execute the "layout" template which wraps around our content block
	err := Templates.ExecuteTemplate(w, "layout", data)
	if err != nil {
		http.Error(w, fmt.Sprintf("Template rendering error: %v", err), http.StatusInternalServerError)
	}
}

// RenderBlock renders a specific partial block template (HTMX dynamic swaps)
func RenderBlock(w http.ResponseWriter, name string, data interface{}) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	err := Templates.ExecuteTemplate(w, name, data)
	if err != nil {
		http.Error(w, fmt.Sprintf("Block rendering error: %v", err), http.StatusInternalServerError)
	}
}
