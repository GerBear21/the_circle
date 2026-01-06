import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { Editor, Frame, Element } from '@craftjs/core';
import {
  Container,
  TextField,
  NumberField,
  Heading,
  Logo,
  CheckboxGroup,
  RadioGroup,
  Rating,
  SignatureField,
  Table,
  Dropdown,
  DateField,
  TextArea,
  Divider,
  Section,
  FileAttachment,
  MultiFileAttachment,
  MultiSelect,
  WatchersField,
  BusinessUnitField,
  DepartmentField,
  CurrencyAmountField
} from '../../../components/form-builder/user';
import { Viewport } from '../../../components/form-builder/Viewport';

export default function NewFormDesignerPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100">
      <Editor resolver={{
        Container,
        TextField,
        NumberField,
        Heading,
        Logo,
        CheckboxGroup,
        RadioGroup,
        Rating,
        SignatureField,
        Table,
        Dropdown,
        DateField,
        TextArea,
        Divider,
        Section,
        FileAttachment,
        MultiFileAttachment,
        MultiSelect,
        WatchersField,
        BusinessUnitField,
        DepartmentField,
        CurrencyAmountField
      }}>
        <Viewport>
          <Frame>
            <Element is={Container} canvas className="bg-white shadow-lg min-h-[800px] p-8 max-w-[210mm] mx-auto rounded-lg">
              <Logo />
              <Heading text="New Form Request" level={1} align="center" color="#333333" />
              <Element is={Container} canvas className="space-y-4 mt-4">
                <TextField label="Full Name" placeholder="John Doe" required={true} />
                <TextField label="Email Address" placeholder="john@example.com" />
              </Element>
            </Element>
          </Frame>
        </Viewport>
      </Editor>
    </div>
  );
}
