import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FrasiService {

  private readonly frasiUrl = 'assets/json/frasi.json';

  constructor(private http: HttpClient) { }

  getFrasi(): Observable<any> {
    return this.http.get<any>(this.frasiUrl);
  }


}
