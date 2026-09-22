import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from '@layout/header/header';
import { Footer } from '@layout/footer/footer';
import { FooterOverlay } from '@layout/footer-overlay/footer-overlay';

@Component({
  selector: 'app-main-layout',
  imports: [Header, Footer, FooterOverlay, RouterOutlet],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {}
