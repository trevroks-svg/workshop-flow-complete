alter table parts_requests
add column if not exists quote_pdf_text text,
add column if not exists quote_pdf_extracted_at timestamptz;
