# scripts/document_analyzer.py
import os
import sys
import json
from typing import List

from langchain_community.document_loaders import (
    PyPDFLoader,
    UnstructuredImageLoader,
    UnstructuredWordDocumentLoader,
    CSVLoader,
    UnstructuredExcelLoader,
    UnstructuredFileLoader
)
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_anthropic import ChatAnthropic
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from pydantic import BaseModel, Field

class DocumentAnalyzer:
    def __init__(self, anthropic_api_key=None):
        """Initialize the document analyzer with Claude Haiku."""
        if anthropic_api_key is None:
            anthropic_api_key = os.environ.get("ANTHROPIC_API_KEY")
            if not anthropic_api_key:
                raise ValueError("Anthropic API key must be provided or set as environment variable")
        
        self.llm = ChatAnthropic(
            temperature=0,
            model="claude-3-haiku-20240307",
            anthropic_api_key=anthropic_api_key
        )
        
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=4000,
            chunk_overlap=200
        )
    
    def load_document(self, file_path: str):
        """Load a document based on its file extension."""
        print(f"Loading document: {file_path}")
        
        file_extension = os.path.splitext(file_path)[1].lower()
        
        try:
            if file_extension == '.pdf':
                loader = PyPDFLoader(file_path)
            elif file_extension in ['.png', '.jpg', '.jpeg']:
                loader = UnstructuredImageLoader(file_path)
            elif file_extension in ['.docx', '.doc']:
                loader = UnstructuredWordDocumentLoader(file_path)
            elif file_extension == '.csv':
                loader = CSVLoader(file_path)
            elif file_extension in ['.xlsx', '.xls']:
                loader = UnstructuredExcelLoader(file_path)
            else:
                # Fallback to general file loader
                loader = UnstructuredFileLoader(file_path)
                
            documents = loader.load()
            print(f"Successfully loaded document with {len(documents)} page(s)/section(s)")
            return documents
        
        except Exception as e:
            print(f"Error loading document: {e}")
            return None
    
    def extract_important_info(self, documents, naming_convention):
        """Extract important information from documents based on the naming convention."""
        # Combine document texts
        all_texts = [doc.page_content for doc in documents]
        combined_text = "\n\n".join(all_texts)
        
        # Split text if it's too long
        if len(combined_text) > 10000:
            print("Document is large, splitting into chunks...")
            chunks = self.text_splitter.split_text(combined_text)
            # Use first chunk(s) for analysis - adjust as needed
            combined_text = "\n\n".join(chunks[:2])
            print(f"Analyzing first {len(combined_text)} characters...")
        
        # Create prompt for extracting information
        prompt_template = PromptTemplate(
            input_variables=["text", "naming_convention"],
            template="""
            You are an expert document analyzer. The following is a document that needs information extraction.
            
            DOCUMENT TEXT:
            {text}
            
            NAMING CONVENTION REQUIRED:
            {naming_convention}
            
            Based on the naming convention, extract the specific information from the document.
            Only include information that is explicitly stated in the document.
            Return your result as a JSON object with keys matching the requirements in the naming convention.
            Return ONLY the JSON object, no explanations or other text.
            """
        )
        
        # Create chain for extraction
        extraction_chain = LLMChain(llm=self.llm, prompt=prompt_template)
        
        # Extract information
        print("Extracting information based on naming convention...")
        result = extraction_chain.run(text=combined_text, naming_convention=naming_convention)
        return result
    
    def generate_filename(self, extracted_info, naming_convention, original_extension):
        """Generate a new filename based on extracted information and naming convention."""
        prompt_template = PromptTemplate(
            input_variables=["extracted_info", "naming_convention"],
            template="""
            Given the following extracted information from a document:
            {extracted_info}
            
            And this naming convention:
            {naming_convention}
            
            Generate a filename that follows the naming convention using the extracted information.
            Only return the filename itself, no explanations or other text.
            Do not include a file extension in your response.
            """
        )
        
        filename_chain = LLMChain(llm=self.llm, prompt=prompt_template)
        filename = filename_chain.run(extracted_info=extracted_info, naming_convention=naming_convention)
        
        # Clean up filename to ensure it's valid
        filename = filename.strip().replace('\n', '').replace('\r', '')
        
        # Replace invalid characters for filenames
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            filename = filename.replace(char, '_')
        
        # Add original file extension
        return f"{filename}{original_extension}"
    
    def rename_file(self, original_path, new_filename):
        """Rename the file with the new filename."""
        try:
            directory = os.path.dirname(original_path)
            new_path = os.path.join(directory, new_filename)
            
            # Check if file with new name already exists
            if os.path.exists(new_path):
                base, ext = os.path.splitext(new_filename)
                i = 1
                while os.path.exists(os.path.join(directory, f"{base}_{i}{ext}")):
                    i += 1
                new_path = os.path.join(directory, f"{base}_{i}{ext}")
                new_filename = f"{base}_{i}{ext}"
            
            os.rename(original_path, new_path)
            print(f"File renamed successfully to: {new_filename}")
            return new_path
        
        except Exception as e:
            print(f"Error renaming file: {e}")
            return None

def main():
    if len(sys.argv) != 3:
        print("Usage: python document_analyzer.py <file_path> <naming_convention>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    naming_convention = sys.argv[2]
    
    analyzer = DocumentAnalyzer()
    
    # Load the document
    documents = analyzer.load_document(file_path)
    if not documents:
        print("Failed to load document. Exiting.")
        sys.exit(1)
    
    # Extract important information
    extracted_info = analyzer.extract_important_info(documents, naming_convention)
    print(f"Extracted information: {extracted_info}")
    
    # Generate new filename
    original_extension = os.path.splitext(file_path)[1]
    new_filename = analyzer.generate_filename(
        extracted_info, 
        naming_convention,
        original_extension
    )
    print(f"Generated new filename: {new_filename}")
    
    # For the web version, we don't actually rename the file
    # Just return the suggested filename
    # analyzer.rename_file(file_path, new_filename)

if __name__ == "__main__":
    main()