import React, { useState } from 'react';
import {
  Editor,
  EditorState,
  Modifier,
  CompositeDecorator,
  getDefaultKeyBinding,
} from 'draft-js';
import 'draft-js/dist/Draft.css';

const suggestions = ['apple', 'banana', 'cherry', 'date', 'elderberry'];

const AutocompleteEditor = () => {
  const [editorState, setEditorState] = useState(() =>
    EditorState.createEmpty()
  );
  const [matchString, setMatchString] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Handle key events for navigating and selecting suggestions
  const handleKeyCommand = (command: string) => {
    if (matchString && filteredSuggestions.length) {
      if (command === 'up') {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        return 'handled';
      } else if (command === 'down') {
        setHighlightedIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        return 'handled';
      } else if (command === 'enter' || command === 'tab') {
        insertSuggestion(filteredSuggestions[highlightedIndex]);
        return 'handled';
      }
    }
    return 'not-handled';
  };

  const insertSuggestion = (suggestion: string) => {
    const contentState = editorState.getCurrentContent();
    const selectionState = editorState.getSelection();

    // Replace the current text with the selected suggestion
    const contentStateWithText = Modifier.replaceText(
      contentState,
      selectionState,
      suggestion + ' '
    );

    const newEditorState = EditorState.push(
      editorState,
      contentStateWithText,
      'insert-characters'
    );

    setEditorState(EditorState.moveFocusToEnd(newEditorState));
    setMatchString('');
    setFilteredSuggestions([]);
    setHighlightedIndex(0);
  };

  const handleBeforeInput = (chars: string) => {
    const contentState = editorState.getCurrentContent();
    const selectionState = editorState.getSelection();
    const blockKey = selectionState.getStartKey();
    const blockText = contentState.getBlockForKey(blockKey).getText();
    const caretPosition = selectionState.getStartOffset();

    const textBeforeCaret = blockText.slice(0, caretPosition) + chars;

    // Match the word after '<'
    const match = textBeforeCaret.match(/<([a-zA-Z]*)$/);
    if (match) {
      const newMatchString = match[1]; // Extract word after '<'
      setMatchString(newMatchString);

      // Filter suggestions that match the entered word
      setFilteredSuggestions(
        suggestions.filter((s) =>
          s.toLowerCase().startsWith(newMatchString.toLowerCase())
        )
      );

      return 'handled';
    }

    // Clear suggestions if no match
    setMatchString('');
    setFilteredSuggestions([]);
    return 'not-handled';
  };

  const keyBindingFn = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') return 'up';
    if (e.key === 'ArrowDown') return 'down';
    if (e.key === 'Enter' || e.key === 'Tab') return 'enter';
    return getDefaultKeyBinding(e);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '8px',
          minHeight: '200px',
          position: 'relative',
        }}
      >
        <Editor
          editorState={editorState}
          onChange={setEditorState}
          handleBeforeInput={handleBeforeInput}
          handleKeyCommand={handleKeyCommand}
          keyBindingFn={keyBindingFn}
          placeholder="Type < followed by a word to see suggestions..."
        />
        {/* Render dropdown here */}
        {filteredSuggestions.length > 0 && (
          <ul
            style={{
              position: 'absolute',
              zIndex: 10,
              marginTop: '8px',
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              borderRadius: '4px',
              listStyle: 'none',
              padding: '8px 0',
              width: '200px',
            }}
          >
            {filteredSuggestions.map((suggestion, index) => (
              <li
                key={suggestion}
                style={{
                  padding: '8px',
                  cursor: 'pointer',
                  backgroundColor: index === highlightedIndex ? '#ddd' : '#fff',
                }}
                onMouseDown={() => insertSuggestion(suggestion)}
              >
                {suggestion}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AutocompleteEditor;
