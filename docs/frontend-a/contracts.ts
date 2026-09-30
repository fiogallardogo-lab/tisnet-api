/** Snapshot de contratos HTTP: 2026-09-30, backend 0ef120d. Sin dependencia de Nest/Prisma. */
export type ISODateTime = string;
export type DateOnly = string;
export type Json = null | boolean | number | string | Json[] | { [key:string]: Json };
export type Role = 'CLIENT' | 'DEVELOPER' | 'PRODUCT_OWNER' | 'ADMIN' | 'SUPER_ADMIN';
export interface ApiSuccess<T> { success:true; message:string; data:T }
export interface ApiError { success:false; message:string|string[]; error:string }
export interface AuthMe { id:number; email:string; role:Role }
export interface OwnUser extends AuthMe { name:string; isActive:boolean }
export interface LoginRequest { email:string; password:string }
export interface LoginResponse { accessToken:string; refreshToken:string; user:AuthMe }
export interface RefreshRequest { refreshToken:string }
export interface RefreshResponse { accessToken:string }
export type ProjectStatus = "DRAFT" | "IN_DEVELOPMENT" | "IN_REVIEW" | "COMPLETED" | "ARCHIVED";
export type QuoteStatus = "RECEIVED";
export type MeetingStatus = "PENDING" | "SCHEDULED" | "CANCELLED" | "COMPLETED";
export type ProjectMemberRole = "CLIENT" | "DEVELOPER" | "PRODUCT_OWNER";
export type DeliverableStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "OBSERVED";
export interface DbClientProfile {
  id: number;
  userId: number;
  dni: string | null;
  age: number | null;
  phone: string | null;
  district: string | null;
  businessName: string | null;
  ruc: string | null;
  commercialName: string | null;
  businessDistrict: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export interface DbDeveloperProfile {
  id: number;
  userId: number;
  career: string | null;
  university: string | null;
  academicStatus: string | null;
  experienceYears: number | null;
  specialty: string | null;
  cvUrl: string | null;
  photoUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export interface DbProjectDeliverable {
  milestoneId: number | null;
  id: number;
  projectId: number;
  title: string;
  description: string;
  milestoneOrder: number;
  dueDate: ISODateTime;
  status: DeliverableStatus;
  fileUrl: string | null;
  externalLink: string | null;
  feedbackNotes: string | null;
  submittedAt: ISODateTime | null;
  reviewedAt: ISODateTime | null;
  reviewedById: number | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export interface DbProjectMember {
  technicalRole: string | null;
  participationBasisPoints: number;
  id: number;
  projectId: number;
  userId: number;
  memberRole: ProjectMemberRole;
  isActive: boolean;
  createdAt: ISODateTime;
}
export interface DbMilestoneContribution {
  id: number;
  projectId: number;
  milestoneId: number | null;
  deliverableId: number | null;
  userId: number;
  percentage: number;
  description: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export interface DbKickoff {
  id: number;
  projectId: number;
  meetingId: number | null;
  actorId: number;
  heldAt: ISODateTime;
  notes: string | null;
  createdAt: ISODateTime;
}

export interface Technology {id:number;name:string;icon:string|null}
export type ClientProfile = Omit<DbClientProfile,'userId'> & {type:'CLIENT'};
export type DeveloperProfile = Omit<DbDeveloperProfile,'userId'> & {type:'DEVELOPER';technologies:Technology[]};
export interface OwnProfile {user:OwnUser;profile:ClientProfile|DeveloperProfile|null}
export interface UpdateOwnUser {name?:string;acceptedTerms?:true;termsVersion?:string;privacyVersion?:string}
export interface UpdatedUser extends OwnUser {acceptedTermsAt:ISODateTime|null;termsVersion:string|null;privacyVersion:string|null}
export interface UpdateClientProfile {dni?:string|null;age?:number|null;phone?:string|null;district?:string|null;businessName?:string|null;ruc?:string|null;commercialName?:string|null;businessDistrict?:string|null}
export interface UpdateDeveloperProfile {career?:string|null;university?:string|null;academicStatus?:string|null;experienceYears?:number|null;specialty?:string|null;technologyIds?:number[];cvUrl?:string|null;photoUrl?:string|null;linkedinUrl?:string|null;githubUrl?:string|null}
export interface ProjectCard {id:number;name:string;summary:string;description:string;status:ProjectStatus;progress:number|null;startedAt:string|null;estimatedDeliveryAt:string|null;teamSize:number;totalDeliverables:number;pendingDeliverables:number;milestones:Array<{id:number;title:string;status:DeliverableStatus;date:string}>}
export type ClientProjectCard = ProjectCard & {locked:boolean};
export interface QuoteSummary {id:string;publicCode:string;code:string;solutionType:string;status:QuoteStatus;amountMinor:string|null;currency:string|null;notes:string|null;createdAt:ISODateTime}
export interface MeetingSummary {id:number;status:MeetingStatus;scheduledAt:ISODateTime|null;timezone:string;notes:string|null;createdAt:ISODateTime;updatedAt:ISODateTime;advisorName:string|null}
export interface Advisor {id:number;name:string;email:string;executiveTitle:string;specialty:string|null;photoUrl:string|null;calendlyUrl:string|null}
export interface ClientOverview {user:{name:string;email:string};projects:ClientProjectCard[];quotes:QuoteSummary[];meetings:MeetingSummary[];advisor:Advisor|null;activity:Array<{id:string;kind:string;title:string;description:string;date:ISODateTime;to:string}>}
/** No endpoint de dashboard Developer: construir tarjetas a partir de este arreglo. */
export type WorkspaceProjects = ProjectCard[];
export interface Agreement {quoteId:number;code:string;activeVersion:number;amountMinor:number;currency:string;officialAt:ISODateTime;acceptedAt:ISODateTime|null;acceptedVersionId:number|null;versions:QuoteVersion[];installments:AgreementInstallment[]}
export interface QuoteVersion {id:number;version:number;code:string;kind:'OFFICIAL';status:'ACCEPTED'|'SENT'|'SUPERSEDED';amountMinor:number;currency:string;createdAt:ISODateTime;notes:Json;canAccept:boolean;installments:Array<{id:number;label:string;percentage:number;amountMinor:number;currency:string;dueDate:DateOnly;status:'PAID'|'PENDING'}>}
export interface AgreementInstallment {id:number;sequence:number;milestone:string;dueDate:ISODateTime;amountMinor:number;paidMinor:number;status:'PAID'|'PENDING'}
export interface AcceptQuote {versionId:number;accepted:true}
export interface Acceptance {accepted:true;acceptedAt:ISODateTime}
export interface QuoteObservationRequest {versionId:number;text:string}
export interface QuoteObservation {id:number;quoteId:number;versionId:number;authorId:number;text:string;createdAt:ISODateTime}
export interface QuoteObservations {items:QuoteObservation[]}
export interface FinancialStatus {quoteId:number;versionId?:number;version?:number;currency?:string;state:'NO_OFFICIAL_VERSION'|'INCONSISTENT'|'UNACCEPTED'|'OPEN'|'PAID';complete:boolean;totalMinor:number;paidMinor:number;outstandingMinor:number;installments:Array<{id:number;sequence:number;amountMinor:number;paidMinor:number;outstandingMinor:number;valid:boolean;complete:boolean}>}
export type Deliverable = DbProjectDeliverable & {reviewedBy:{id:number;name:string}|null};
export type Member = DbProjectMember & {user:{name:string}};
export interface OperationsMember {id:number;userId:number;name:string;role:ProjectMemberRole;memberRole:ProjectMemberRole;technicalRole:string|null;participation:number;participationBasisPoints:number;isActive:boolean}
export interface ProjectOperations {projectId:number;name:string;slug:string;shortDescription:string;status:ProjectStatus;developmentDate:ISODateTime|null;quoteId?:number|null;clientUserId?:number|null;productOwnerId:number|null;kickoff:{status:MeetingStatus;scheduledAt:ISODateTime|null;notes:string;canStart:boolean;blockingReason?:string};members:OperationsMember[];milestones:Array<{id:number;title:string;dueDate:ISODateTime;sequence:number;deliverables:DbProjectDeliverable[];amountMinor?:string|null;percentageBasisPoints?:number|null;paymentScheduleId?:number}>;candidates:Array<{id:number;name:string;role:string}>;canManageTeam:boolean;canManageKickoff:boolean;canViewFinance:boolean}
export interface CreateDeliverable {title:string;description:string;milestoneOrder:number;dueDate:DateOnly}
export interface SubmitEvidence {pdfUrl?:string;fileUrl?:string;videoUrl:string;notes?:string}
/** En multipart añadir file: Blob/File. No establecer Content-Type manualmente. */
export interface EvidenceResponse {id:number;milestoneId:number;projectId:number;title:string;status:DeliverableStatus;pdfUrl:string|null;videoUrl:string|null;notes:string|null;submittedAt:ISODateTime|null}
export type ReviewDeliverable = {decision:'APPROVE';feedbackNotes?:string}|{decision:'OBSERVE';feedbackNotes:string};
export interface DeliverableHistory {id:number;action:string;actorId:number;actorName:string;actorRole:string;fileUrl:string|null;videoUrl:string|null;comments:string|null;timestamp:ISODateTime}
export interface UploadedFile {url:string;storageKey:string;filename:string;sizeBytes:number;mimeType:string}
export interface RequestMeeting {advisorId:number;scheduledAt:ISODateTime;notes?:string}
export interface MeetingRequested {id:number;status:'PENDING';scheduledAt:ISODateTime}
export interface MeetingCancelled {id:number;status:'CANCELLED'}
export interface ScheduleKickoff {advisorId?:number;scheduledAt:ISODateTime;notes?:string}
export interface SaveContributions {contributions:Array<{userId:number;percentage:number;description:string}>}
/** Contrato actual devuelve email a miembros autorizados; no publicarlo fuera del equipo. */
export type Contribution = DbMilestoneContribution & {user:{id:number;name:string;email:string;role:{name:string}}};
export interface ProjectContributions {projectId:number;totalMilestones:number;deliverables:Array<{id:number;title:string;milestoneOrder:number;status:DeliverableStatus;dueDate:ISODateTime;contributions:Array<{id:number;userId:number;userName:string;userRole:string;percentage:number;description:string}>}>;teamSummary:Array<{user:{id:number;name:string;email:string;role:string};averagePercentage:number;milestonesContributed:number;tasks:string[]}>}
export interface ProgressReport {canViewFinance:boolean;projects:Array<{projectId:number;name:string;progress:number;approvedDeliverables:number;pendingDeliverables:number;totalMinor?:number;paidMinor?:number;currency?:string}>;generatedAt:ISODateTime}
export interface TraceabilityReport {project:{id:number;name:string;slug:string;status:ProjectStatus;progress:number;createdAt:ISODateTime;client:{name:string}|null;productOwner:{name:string}|null};commercial:{quoteCode?:string;version:number;amountMinor:number;currency:string;schedulesCount:number}|null;team:Array<{id:number;name:string;memberRole:ProjectMemberRole;technicalRole:string|null;participationBasisPoints:number}>;milestones:Array<{id:number;milestoneOrder:number;title:string;description:string;status:DeliverableStatus;dueDate:ISODateTime;pdfUrl:string|null;videoUrl:string|null;feedbackNotes:string|null;submittedAt:ISODateTime|null;reviewedAt:ISODateTime|null;reviewedBy:string|null;contributions:Array<{userId:number;name:string;percentage:number;description:string}>;history:Array<Omit<DeliverableHistory,'id'|'actorId'>>}>;teamContributions:Array<{userId:number;name:string;averagePercentage:number;milestonesContributed:number;tasks:string[]}>;generatedAt:ISODateTime}
/** Propuestas SOLO para mocks: no hay rutas ni fecha comprometida. */
export namespace Proposed {
 export interface Task {id:number;projectId:number;title:string;assigneeId:number|null;status:'TODO'|'IN_PROGRESS'|'DONE';dueDate:DateOnly|null}
 export interface Resource {id:number;projectId:number;name:string;url:string;kind:'LINK'|'FILE'}
 export interface Page<T> {items:T[];page:number;limit:number;totalItems:number;totalPages:number}
 export interface DeveloperDashboard {projects:ProjectCard[];tasks:Task[];upcomingMeetings:MeetingSummary[]}
}

export type Deliverables = Deliverable[];
export type Members = Member[];
export type History = DeliverableHistory[];
export type Contributions = Contribution[];
export interface PhotoResponse {photoUrl:string}
export interface EmptyResponse {value?:never}
export interface UploadRequest {file:string}
export interface PhotoRequest {photo:string}
export interface EvidenceMultipart extends SubmitEvidence {file?:string}
export interface ChargeRequest {tokenId:string}
export interface ChargeResponse {chargeId:string;status:'PENDING_CONFIRMATION'}
export interface CheckoutResponse {orderId:string;paymentCode?:string;qrCode?:string;amountMinor:number;currency:string;expirationDate:ISODateTime;checkoutUrl:string}

export type Cliente = OwnUser & {role:'CLIENT'};
export type Developer = OwnUser & {role:'DEVELOPER'};
export interface PublicQuoteRequest {solutionType:string;options:Array<{code:string}>;deliveryMode?:'NORMAL'|'URGENT'|'FLEXIBLE';contact:{fullName:string;email:string;phone:string;company?:string};notes?:string}
export interface PortalQuoteRequest extends PublicQuoteRequest {catalogVersion?:'SP-01-v2'}
export interface PublicQuoteResponse {code:string;status:'RECEIVED';pricingStatus:'PENDING_RULES'|'CALCULATED';amountMinor:number|null;currency:string|null;pricingVersion:string|null;createdAt:ISODateTime}
export interface LegacySubmit {fileUrl?:string;externalLink?:string}
