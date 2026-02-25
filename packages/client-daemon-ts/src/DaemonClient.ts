/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest';
import type { OpenAPIConfig } from './core/OpenAPI';
import { FetchHttpRequest } from './core/FetchHttpRequest';
import { ComputerUseService } from './services/ComputerUseService';
import { FileSystemService } from './services/FileSystemService';
import { GitService } from './services/GitService';
import { InfoService } from './services/InfoService';
import { InterpreterService } from './services/InterpreterService';
import { LspService } from './services/LspService';
import { PortService } from './services/PortService';
import { ProcessService } from './services/ProcessService';
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class DaemonClient {
    public readonly computerUse: ComputerUseService;
    public readonly fileSystem: FileSystemService;
    public readonly git: GitService;
    public readonly info: InfoService;
    public readonly interpreter: InterpreterService;
    public readonly lsp: LspService;
    public readonly port: PortService;
    public readonly process: ProcessService;
    public readonly request: BaseHttpRequest;
    constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = FetchHttpRequest) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? '',
            VERSION: config?.VERSION ?? '0.0.0-dev',
            WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
            CREDENTIALS: config?.CREDENTIALS ?? 'include',
            TOKEN: config?.TOKEN,
            USERNAME: config?.USERNAME,
            PASSWORD: config?.PASSWORD,
            HEADERS: config?.HEADERS,
            ENCODE_PATH: config?.ENCODE_PATH,
        });
        this.computerUse = new ComputerUseService(this.request);
        this.fileSystem = new FileSystemService(this.request);
        this.git = new GitService(this.request);
        this.info = new InfoService(this.request);
        this.interpreter = new InterpreterService(this.request);
        this.lsp = new LspService(this.request);
        this.port = new PortService(this.request);
        this.process = new ProcessService(this.request);
    }
}

