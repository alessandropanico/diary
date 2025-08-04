import { Injectable } from '@angular/core';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, query, where, getDocs, getDoc } from 'firebase/firestore';
import { Observable, from, switchMap, map } from 'rxjs';
import { UserDataService } from 'src/app/services/user-data.service';

export interface Project {
  id?: string;
  name: string;
  description: string;
  status: 'In corso' | 'Completato' | 'In pausa' | 'Archiviato';
  progress: number;
  dueDate?: Date;
  createdAt: Date;
  lastUpdated: Date;
  uid: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProgettiService {
  private db = getFirestore();

  constructor(
    private userDataService: UserDataService
  ) {}

  getProjects(): Observable<Project[]> {
    return this.userDataService.userStatus$.pipe(
      switchMap(uid => {
        if (!uid) {
          return from([[]]);
        }
        const projectsCollection = collection(this.db, 'projects');
        const q = query(projectsCollection, where('uid', '==', uid));
        return from(getDocs(q)).pipe(
          map(snapshot => {
            const projects: Project[] = [];
            snapshot.forEach(doc => {
              const data = doc.data() as Project;
              projects.push({ id: doc.id, ...data });
            });
            return projects;
          })
        );
      })
    );
  }

  getProjectById(id: string): Observable<Project | undefined> {
    return this.userDataService.userStatus$.pipe(
      switchMap(uid => {
        if (!uid) {
          return from([undefined]);
        }
        const projectDocRef = doc(this.db, 'projects', id);
        return from(getDoc(projectDocRef)).pipe(
          map(docSnapshot => {
            if (docSnapshot.exists() && docSnapshot.data()?.['uid'] === uid) {
              const data = docSnapshot.data() as Project;
              return { id: docSnapshot.id, ...data };
            }
            return undefined;
          })
        );
      })
    );
  }

  async addProject(project: Partial<Project>): Promise<string> {
    const userId = this.userDataService.getCurrentUserId();
    if (!userId) {
      throw new Error('User not logged in');
    }
    const newProject: Project = {
      ...project,
      uid: userId,
      description: project.description || '',
      status: project.status || 'In corso',
      progress: project.progress || 0,
      createdAt: new Date(),
      lastUpdated: new Date()
    } as Project;
    const docRef = await addDoc(collection(this.db, 'projects'), newProject);
    return docRef.id;
  }

  async updateProject(id: string, data: Partial<Project>): Promise<void> {
    const projectDocRef = doc(this.db, 'projects', id);
    return updateDoc(projectDocRef, {
      ...data,
      lastUpdated: new Date()
    });
  }

  async deleteProject(id: string): Promise<void> {
    const projectDocRef = doc(this.db, 'projects', id);
    return deleteDoc(projectDocRef);
  }
}
