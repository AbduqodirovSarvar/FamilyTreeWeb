import { Gender } from './gender.enum';

export interface TreeMember {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  description?: string | null;
  gender: Gender;
  birthDay: string;
  deathDay?: string | null;
  imageId?: string | null;
  imageUrl?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  spouseName?: string | null;
}

export interface SpouseGroup {
  spouse: TreeMember;
  children: TreeNode[];
}

export interface TreeNode {
  primary: TreeMember;
  spouses: SpouseGroup[];
  commonChildren: TreeNode[];
}

export interface FamilyTree {
  familyId: string;
  name?: string | null;
  familyName?: string | null;
  totalMembers: number;
  roots: TreeNode[];
}
