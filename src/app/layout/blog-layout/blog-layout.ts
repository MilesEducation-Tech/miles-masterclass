import { Component } from '@angular/core';
import { Header } from '@layout/header/header';
import { RouterOutlet } from '@angular/router';
import { Footer } from '@layout/footer/footer';

@Component({
  selector: 'app-blog-layout',
  imports: [Header, RouterOutlet, Footer],
  templateUrl: './blog-layout.html',
  styleUrl: './blog-layout.css',
})
export class BlogLayout {}
