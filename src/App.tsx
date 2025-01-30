import React, { useState } from 'react';
import {
  Editor,
  EditorState,
  Modifier,
  CompositeDecorator,
  getDefaultKeyBinding,
} from 'draft-js';
import 'draft-js/dist/Draft.css';

const suggestions = ['apple', 'and', 'banana', 'cherry', 'date', 'elderberry'];

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
            <span style={{ color: 'blue', fontWeight: 'bold' }}>
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

    console.log('textBeforeCaret:', textBeforeCaret);

    // Match the string after "<" until the caret position
    const match = textBeforeCaret.match(/<([^<]*)$/); // Capture everything after "<"

    if (match) {
      const newMatchString = match[1]; // Extract the matched part
      setMatchString(newMatchString);

      console.log('Matched String:', newMatchString);

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

      // Update editor state and ensure the caret is visible
      setEditorState(newEditorState);
      return 'handled';
    }

    // If the input is a backspace or delete and there is no match string, clear suggestions
    if (chars === '' || chars === 'backspace') {
      setMatchString('');
      setFilteredSuggestions([]);
      return 'handled';
    }

    // Clear suggestions if no match
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

      // Get the text before the caret (all characters before the caret)
      const textBeforeCaret = blockText.slice(0, caretPosition);

      console.log('backspace textBeforeCaret:', textBeforeCaret);

      // Check if "<" is present and if the user is typing after it
      const match = textBeforeCaret.match(/<([^<]*)$/); // Match text after "<"

      if (match) {
        const newMatchString = match[1]; // Extract the matched part after "<"
        setMatchString(newMatchString);

        console.log('Matched String after Backspace:', newMatchString);

        // Filter suggestions based on the match string
        setFilteredSuggestions(
          suggestions.filter((s) =>
            s.toLowerCase().startsWith(newMatchString.toLowerCase())
          )
        );
      }

      // Handle removing the character(s) when backspace is pressed
      if (caretPosition > 0) {
        const contentStateWithDelete = Modifier.removeRange(
          contentState,
          selectionState.merge({
            focusOffset: caretPosition,
            anchorOffset: caretPosition - 1,
          }),
          'backward' // Remove the character at the caret position
        );

        const newEditorState = EditorState.push(
          editorState,
          contentStateWithDelete,
          'backspace-character'
        );

        // Update editor state to reflect the deletion
        setEditorState(newEditorState);

        // After deletion, log the updated match string (i.e., after the change)
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
          console.log(
            'Updated Match String after Backspace:',
            updatedMatchString
          );
          setFilteredSuggestions(
            suggestions.filter((s) =>
              s.toLowerCase().startsWith(updatedMatchString.toLowerCase())
            )
          );
        } else {
          // If the match string is empty or "<" has been deleted, clear the suggestions
          setFilteredSuggestions([]);
          setMatchString('');
        }

        return 'handled';
      }
    }

    // Handle other commands like navigating the suggestions
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

    // Find the range of the match string after "<"
    const blockKey = selectionState.getStartKey();
    const blockText = contentState.getBlockForKey(blockKey).getText();
    const caretPosition = selectionState.getStartOffset();

    // Create a regular expression to find the part starting from "<"
    const match = blockText.slice(0, caretPosition).match(/<([^<]*)$/);

    if (match) {
      // Replace the entire match with the suggestion
      const matchLength = match[0].length;

      // Replace the match with the selected suggestion
      const contentStateWithEntity = contentState.createEntity(
        'AUTOCOMPLETE',
        'IMMUTABLE',
        { suggestion }
      );
      const entityKey = contentStateWithEntity.getLastCreatedEntityKey();

      const contentStateWithText = Modifier.replaceText(
        contentState,
        selectionState.merge({
          focusOffset: selectionState.getStartOffset(),
          anchorOffset:
            selectionState.getStartOffset() - matchLength + suggestion.length,
        }),
        suggestion + ' ',
        undefined,
        entityKey
      );

      const newEditorState = EditorState.push(
        editorState,
        contentStateWithText,
        'insert-characters'
      );

      // Update the editor state and reset match string and suggestions
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
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '8px',
          minHeight: '200px',
          position: 'relative',
        }}
        onClick={() => {
          if (!editorState.getSelection().getHasFocus()) {
            setEditorState(EditorState.moveFocusToEnd(editorState));
          }
        }}
      >
        <div style={{ position: 'relative' }}>
          <Editor
            editorState={editorState}
            onChange={setEditorState}
            handleBeforeInput={handleBeforeInput}
            handleKeyCommand={handleKeyCommand}
            keyBindingFn={keyBindingFn}
            placeholder="Type < followed by a word to see suggestions..."
          />
        </div>
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
