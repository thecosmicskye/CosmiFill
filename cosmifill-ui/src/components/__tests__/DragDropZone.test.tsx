import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DragDropZone } from '../DragDropZone';

// Mock react-dropzone
jest.mock('react-dropzone', () => ({
  useDropzone: (options: any) => {
    const { onDrop } = options;
    return {
      getRootProps: () => ({
        onDrop: (e: any) => {
          e.preventDefault();
          if (onDrop) onDrop(e.dataTransfer.files);
        },
      }),
      getInputProps: () => ({}),
      isDragActive: false,
      open: jest.fn(),
    };
  },
}));

describe('DragDropZone Component', () => {
  const mockOnFilesDropped = jest.fn();
  const defaultProps = {
    onFilesDropped: mockOnFilesDropped,
    accept: {
      'application/pdf': ['.pdf'],
    },
    label: 'Drop PDF files here',
  };

  beforeEach(() => {
    mockOnFilesDropped.mockClear();
  });

  it('should render with label', () => {
    render(<DragDropZone {...defaultProps} />);
    
    expect(screen.getByText('Drop PDF files here')).toBeInTheDocument();
  });

  it('should display upload icon', () => {
    const { container } = render(<DragDropZone {...defaultProps} />);
    
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should have proper styling classes', () => {
    const { container } = render(<DragDropZone {...defaultProps} />);
    
    const dropZone = container.querySelector('.border-dashed');
    expect(dropZone).toBeInTheDocument();
    expect(dropZone).toHaveClass('border-dashed');
  });

  it.skip('should handle file drop', async () => {
    const { container } = render(<DragDropZone {...defaultProps} />);
    
    const dropZone = container.querySelector('[onDrop]');
    const mockFiles = [
      new File(['content'], 'test.pdf', { type: 'application/pdf' }),
    ];
    
    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: { files: mockFiles },
    };
    
    if (dropZone) {
      fireEvent.drop(dropZone, dropEvent);
    }
    
    await waitFor(() => {
      expect(mockOnFilesDropped).toHaveBeenCalledWith(mockFiles);
    });
  });

  it('should show browse button', () => {
    render(<DragDropZone {...defaultProps} />);
    
    expect(screen.getByText(/Browse Files/i)).toBeInTheDocument();
  });
});