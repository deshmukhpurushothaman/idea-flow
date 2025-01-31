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
    EditorState.createEmpty(
      new CompositeDecorator([
        {
          strategy: (contentBlock, callback, contentState) => {
            contentBlock.findEntityRanges((character) => {
              const entityKey = character.getEntity();
              return (
                entityKey !== null &&
                contentState.getEntity(entityKey).getType() === 'AUTOCOMPLETE'
              );
            }, callback);
          },
          component: ({ children }) => (
            <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>
              {children}
            </span>
          ),
        },
      ])
    )
  );
  const [matchString, setMatchString] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const handleBeforeInput = (chars: string) => {
    const contentState = editorState.getCurrentContent();
    const selectionState = editorState.getSelection();
    const blockKey = selectionState.getStartKey();
    const blockText = contentState.getBlockForKey(blockKey).getText();
    const caretPosition = selectionState.getStartOffset();

    // Combine the current input with the text before the caret
    const textBeforeCaret = blockText.slice(0, caretPosition) + chars;

    // Match the string after "<" until the caret position
    const match = textBeforeCaret.match(/<([^<]*)$/);

    if (match) {
      const newMatchString = match[1];
      setMatchString(newMatchString);

      // Filter suggestions based on the string after "<"
      setFilteredSuggestions(
        suggestions.filter((s) =>
          s.toLowerCase().startsWith(newMatchString.toLowerCase())
        )
      );

      // Insert the character (like '<') into the editor manually
      const contentStateWithText = Modifier.insertText(
        contentState,
        selectionState,
        chars
      );
      const newEditorState = EditorState.push(
        editorState,
        contentStateWithText,
        'insert-characters'
      );

      setEditorState(newEditorState);
      return 'handled';
    }

    // Handle backspace or empty input
    if (chars === '' || chars === 'backspace') {
      setMatchString('');
      setFilteredSuggestions([]);
      return 'handled';
    }

    setMatchString('');
    setFilteredSuggestions([]);
    return 'not-handled';
  };

  const handleKeyCommand = (command: string) => {
    if (command === 'backspace') {
      const contentState = editorState.getCurrentContent();
      const selectionState = editorState.getSelection();
      const blockKey = selectionState.getStartKey();
      const blockText = contentState.getBlockForKey(blockKey).getText();
      const caretPosition = selectionState.getStartOffset();

      const textBeforeCaret = blockText.slice(0, caretPosition);
      const match = textBeforeCaret.match(/<([^<]*)$/);

      if (match) {
        const newMatchString = match[1];
        setMatchString(newMatchString);

        // Filter suggestions based on the match string
        setFilteredSuggestions(
          suggestions.filter((s) =>
            s.toLowerCase().startsWith(newMatchString.toLowerCase())
          )
        );
      }

      if (caretPosition > 0) {
        const contentStateWithDelete = Modifier.removeRange(
          contentState,
          selectionState.merge({
            focusOffset: caretPosition,
            anchorOffset: caretPosition - 1,
          }),
          'backward'
        );

        const newEditorState = EditorState.push(
          editorState,
          contentStateWithDelete,
          'backspace-character'
        );

        setEditorState(newEditorState);

        const updatedContentState = newEditorState.getCurrentContent();
        const updatedBlockText = updatedContentState
          .getBlockForKey(blockKey)
          .getText();
        const updatedCaretPosition = selectionState.getStartOffset();
        const updatedTextBeforeCaret = updatedBlockText.slice(
          0,
          updatedCaretPosition
        );

        const updatedMatch = updatedTextBeforeCaret.match(/<([^<]*)$/);
        if (updatedMatch) {
          const updatedMatchString = updatedMatch[1];
          setMatchString(updatedMatchString);
          setFilteredSuggestions(
            suggestions.filter((s) =>
              s.toLowerCase().startsWith(updatedMatchString.toLowerCase())
            )
          );
        } else {
          setFilteredSuggestions([]);
          setMatchString('');
        }

        return 'handled';
      }
    }

    if (filteredSuggestions.length) {
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
  
    const blockKey = selectionState.getStartKey();
    const blockText = contentState.getBlockForKey(blockKey).getText();
    const caretPosition = selectionState.getStartOffset();
  
    // Match the characters after '<' including the '<' itself
    const match = blockText.slice(0, caretPosition).match(/<([^<]*)$/);
  
    if (match) {
      const matchLength = match[0].length; // Length of the matched text including '<'
      const startOffset = caretPosition - matchLength; // Start of the match, including '<'
  
      const contentStateWithEntity = contentState.createEntity(
        'AUTOCOMPLETE',
        'IMMUTABLE',
        { suggestion }
      );
      const entityKey = contentStateWithEntity.getLastCreatedEntityKey();
  
      // Replace the range including the '<' and the matched text with the selected suggestion
      const contentStateWithText = Modifier.replaceText(
        contentState,
        selectionState.merge({
          anchorOffset: startOffset, // Start of the replacement
          focusOffset: caretPosition, // End of the replacement
        }),
        suggestion + ' ', // Add a trailing space after the suggestion
        undefined,
        entityKey
      );
  
      const newEditorState = EditorState.push(
        editorState,
        contentStateWithText,
        'insert-characters'
      );
  
      setEditorState(newEditorState);
      setMatchString('');
      setFilteredSuggestions([]);
      setHighlightedIndex(0);
    }
  };
  
  const keyBindingFn = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') return 'up';
    if (e.key === 'ArrowDown') return 'down';
    if (e.key === 'Enter' || e.key === 'Tab') return 'enter';
    return getDefaultKeyBinding(e);
  };

  return (
    <div
      style={{
        margin: 'auto',
        display: 'flex',
        justifyContent: 'center',
        flexDirection: 'column',
        alignContent: 'center',
        alignItems: 'center',
        width: '1000px',
      }}
    >
      <div
        style={{
          fontWeight: 'bolder',
          fontSize: '20px',
          marginBottom: '20px',
        }}
      >
        Draft.js Editor
      </div>
      <div
        style={{
          padding: '20px',
          fontFamily: 'Arial, sans-serif',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          maxWidth: '600px',
          margin: 'auto',
        }}
      >
        <div
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '12px',
            minHeight: '200px',
            position: 'relative',
            backgroundColor: '#fff',
            width: '500px',
          }}
          onClick={() => {
            if (!editorState.getSelection().getHasFocus()) {
              setEditorState(EditorState.moveFocusToEnd(editorState));
            }
          }}
        >
          <Editor
            editorState={editorState}
            onChange={setEditorState}
            handleBeforeInput={handleBeforeInput}
            handleKeyCommand={handleKeyCommand}
            keyBindingFn={keyBindingFn}
            placeholder="Type '<' followed by a word to see suggestions..."
          />
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
                width: '100%',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
              }}
            >
              {filteredSuggestions.map((suggestion, index) => (
                <li
                  key={suggestion}
                  style={{
                    padding: '8px',
                    cursor: 'pointer',
                    backgroundColor:
                      index === highlightedIndex ? '#ddd' : '#fff',
                    color: '#333',
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
    </div>
  );
};

export default AutocompleteEditor;
