export type PersonaMeta = {
  id: string;
  name: string;
  title: string;
  company?: string;
  createdAt: string;
  userId: string | null;
};

export type PersonaIndexFile = {
  personas: PersonaMeta[];
};

export type PersonaPackage = Record<string, string>;
