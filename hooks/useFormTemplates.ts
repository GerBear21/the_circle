import { useState, useEffect, useCallback } from 'react';

export interface FormTemplate {
  id: string;
  name: string;
  description: string | null;
  scope: 'departmental' | 'business_unit' | 'hotel_group';
  scope_department_id: string | null;
  scope_business_unit_id: string | null;
  category: string | null;
  icon: string;
  color: string;
  requestor_fields: string[];
  form_fields: any[];
  workflow_definition_id: string | null;
  inline_workflow_steps: any[] | null;
  inline_workflow_settings: any | null;
  is_active: boolean;
  is_published: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
  creator?: { id: string; display_name: string; email: string };
}

interface UseFormTemplatesOptions {
  scope?: string;
  category?: string;
  search?: string;
  publishedOnly?: boolean;
}

export function useFormTemplates(options: UseFormTemplatesOptions = {}) {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (options.scope && options.scope !== 'all') params.set('scope', options.scope);
      if (options.category && options.category !== 'all') params.set('category', options.category);
      if (options.search) params.set('search', options.search);
      if (options.publishedOnly !== false) params.set('published_only', 'true');

      const res = await fetch(`/api/form-templates?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch form templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err: any) {
      setError(err.message);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [options.scope, options.category, options.search, options.publishedOnly]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return { templates, loading, error, refetch: fetchTemplates };
}

export function useFormTemplate(id: string | null) {
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setTemplate(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/form-templates/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch form template');
        return res.json();
      })
      .then(data => setTemplate(data.template))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  return { template, loading, error };
}
