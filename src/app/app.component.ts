import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterOutlet } from '@angular/router';

import { AuthService } from './services/auth.service';
import { VeltService } from './services/velt.service';

import { SidebarComponent } from './components/sidebar/sidebar.component';
import { DocumentComponent } from './components/document/document.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [RouterOutlet, SidebarComponent, DocumentComponent, ToolbarComponent, NgIf],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss',
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})

export class AppComponent implements OnInit {
	title = 'canvas';

	isFocused = false

	constructor(
		private veltService: VeltService,
		private authService: AuthService,
	) { }

	/**
	 * Initializes the Velt service and set up the collaboration environment.
	 */
	async ngOnInit(): Promise<void> {

		// Initialize Velt with the API key
		await this.veltService.initializeVelt('AN5s6iaYIuLLXul0X4zf');

		// Identify the current user if authenticated
		const user = this.authService.userSignal();
		if (user) {
			await this.veltService.identifyUser(user);
		}

		// Check if the 'focused' query parameter is present and set to 'true'
		const urlParams = new URLSearchParams(window.location.search);
		this.isFocused = urlParams.get('focused') === 'true';

	}
}
