import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileList } from '../FileList';

describe('FileList Component', () => {
  const mockFiles = [
    {
      id: '1',
      name: 'document.pdf',
      size: 1024 * 1024, // 1 MB
      type: 'application/pdf',
      file: new File([''], 'document.pdf', { type: 'application/pdf' }),
    },
    {
      id: '2', 
      name: 'data.csv',
      size: 512 * 1024, // 512 KB
      type: 'text/csv',
      file: new File([''], 'data.csv', { type: 'text/csv' }),
    },
  ];

  const mockOnRemove = jest.fn();

  beforeEach(() => {
    mockOnRemove.mockClear();
  });

  it('should render all files', () => {
    render(<FileList files={mockFiles} onRemove={mockOnRemove} />);
    
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByText('data.csv')).toBeInTheDocument();
  });

  it('should display file sizes correctly', () => {
    render(<FileList files={mockFiles} onRemove={mockOnRemove} />);
    
    expect(screen.getByText('1 MB')).toBeInTheDocument();
    expect(screen.getByText('512 KB')).toBeInTheDocument();
  });

  it('should show correct file type icons', () => {
    const { container } = render(<FileList files={mockFiles} onRemove={mockOnRemove} />);
    
    // Check for PDF icon
    const pdfIcon = container.querySelector('.text-pink-500');
    expect(pdfIcon).toBeInTheDocument();
  });

  it('should call onRemove when remove button clicked', () => {
    render(<FileList files={mockFiles} onRemove={mockOnRemove} />);
    
    const removeButtons = screen.getAllByRole('button');
    fireEvent.click(removeButtons[0]);
    
    expect(mockOnRemove).toHaveBeenCalledWith('1');
  });

  it('should render empty state when no files', () => {
    const { container } = render(<FileList files={[]} onRemove={mockOnRemove} />);
    
    expect(container.firstChild?.childNodes.length).toBe(0);
  });

  it('should have hover effects on remove button', () => {
    const { container } = render(<FileList files={mockFiles} onRemove={mockOnRemove} />);
    
    const removeButton = container.querySelector('button');
    expect(removeButton).toHaveClass('hover:bg-pink-50');
  });
});