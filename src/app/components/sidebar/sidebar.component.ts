import { Component } from '@angular/core';

@Component({
	selector: 'app-sidebar',
	standalone: true,
	imports: [],
	templateUrl: './sidebar.component.html',
	styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
	public iconOnly: boolean = false;

	// Hide Icons if screen size is small
	constructor() {
		this.checkScreenSize();
		window.addEventListener('resize', () => this.checkScreenSize());
	}

	private checkScreenSize(): void {
		this.iconOnly = window.innerWidth < 1200;
	}
}
