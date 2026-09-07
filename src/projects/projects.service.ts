import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { ListPublicProjectsQueryDto } from './dto/list-public-projects-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const projectRelations = {
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  technologies: {
    select: {
      technology: {
        select: {
          id: true,
          name: true,
          icon: true,
        },
      },
    },
  },
} satisfies Prisma.ProjectInclude;

type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: typeof projectRelations;
}>;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto) {
    const { technologyIds = [], developmentDate, features = [], ...data } = dto;

    await this.ensureSlugAvailable(dto.slug);
    await this.ensureActiveCategory(dto.categoryId);
    await this.ensureActiveTechnologies(technologyIds);

    try {
      const project = await this.prisma.project.create({
        data: {
          ...data,
          developmentDate: this.toDatabaseDate(developmentDate),
          features: features as Prisma.InputJsonValue,
          technologies: {
            create: technologyIds.map((technologyId) => ({ technologyId })),
          },
        },
        include: projectRelations,
      });

      return this.toAdminProject(project);
    } catch (error) {
      this.handleUniqueSlugError(error);
      throw error;
    }
  }

  async findAll(query: ListProjectsQueryDto) {
    const { page, limit, search, status, categoryId, isPublished } = query;
    const where: Prisma.ProjectWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { slug: { contains: search } },
              { shortDescription: { contains: search } },
            ],
          }
        : {}),
      ...(status ? { status } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(isPublished === undefined ? {} : { isPublished }),
    };

    const [projects, totalItems] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: projectRelations,
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items: projects.map((project) => this.toAdminProject(project)),
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async findOne(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: projectRelations,
    });

    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    return this.toAdminProject(project);
  }

  async update(id: number, dto: UpdateProjectDto) {
    await this.ensureProjectExists(id);

    const { technologyIds, developmentDate, features, categoryId, slug, ...data } = dto;

    if (slug !== undefined) {
      await this.ensureSlugAvailable(slug, id);
    }
    if (categoryId !== undefined) {
      await this.ensureActiveCategory(categoryId);
    }
    if (technologyIds !== undefined) {
      await this.ensureActiveTechnologies(technologyIds);
    }

    try {
      const project = await this.prisma.project.update({
        where: { id },
        data: {
          ...data,
          ...(slug === undefined ? {} : { slug }),
          ...(categoryId === undefined ? {} : { category: { connect: { id: categoryId } } }),
          ...(developmentDate === undefined
            ? {}
            : { developmentDate: this.toDatabaseDate(developmentDate) }),
          ...(features === undefined
            ? {}
            : { features: features as Prisma.InputJsonValue }),
          ...(technologyIds === undefined
            ? {}
            : {
                technologies: {
                  deleteMany: {},
                  create: technologyIds.map((technologyId) => ({ technologyId })),
                },
              }),
        },
        include: projectRelations,
      });

      return this.toAdminProject(project);
    } catch (error) {
      this.handleUniqueSlugError(error);
      throw error;
    }
  }

  async publish(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }
    if (project.status === ProjectStatus.ARCHIVED) {
      throw new BadRequestException('Un proyecto archivado no puede publicarse');
    }
    if (
      !project.name.trim() ||
      !project.slug.trim() ||
      !project.shortDescription.trim() ||
      !project.description.trim()
    ) {
      throw new BadRequestException('El proyecto no contiene la información mínima para publicarse');
    }
    if (!project.category.isActive) {
      throw new BadRequestException('La categoría del proyecto está inactiva');
    }

    return this.setPublished(id, true);
  }

  async unpublish(id: number) {
    await this.ensureProjectExists(id);
    return this.setPublished(id, false);
  }

  async archive(id: number) {
    await this.ensureProjectExists(id);

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        status: ProjectStatus.ARCHIVED,
        isPublished: false,
      },
      include: projectRelations,
    });

    return this.toAdminProject(project);
  }

  async findPublic(query: ListPublicProjectsQueryDto) {
    const { page, limit, search, categoryId, technologyId, isFeatured } = query;
    const where: Prisma.ProjectWhereInput = {
      isPublished: true,
      status: { not: ProjectStatus.ARCHIVED },
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { shortDescription: { contains: search } },
            ],
          }
        : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(technologyId
        ? { technologies: { some: { technologyId } } }
        : {}),
      ...(isFeatured === undefined ? {} : { isFeatured }),
    };

    const [projects, totalItems] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: projectRelations,
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items: projects.map((project) => this.toPublicListItem(project)),
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async findPublicBySlug(slug: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        slug,
        isPublished: true,
        status: { not: ProjectStatus.ARCHIVED },
      },
      include: projectRelations,
    });

    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    const adminProject = this.toAdminProject(project);
    return {
      id: adminProject.id,
      name: adminProject.name,
      slug: adminProject.slug,
      shortDescription: adminProject.shortDescription,
      description: adminProject.description,
      problem: adminProject.problem,
      solution: adminProject.solution,
      objective: adminProject.objective,
      features: adminProject.features,
      category: adminProject.category,
      technologies: adminProject.technologies,
      developmentDate: adminProject.developmentDate,
      demoUrl: adminProject.demoUrl,
      externalUrl: adminProject.externalUrl,
      coverImageUrl: adminProject.coverImageUrl,
      isFeatured: adminProject.isFeatured,
    };
  }

  private async setPublished(id: number, isPublished: boolean) {
    const project = await this.prisma.project.update({
      where: { id },
      data: { isPublished },
      include: projectRelations,
    });

    return this.toAdminProject(project);
  }

  private async ensureProjectExists(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }
  }

  private async ensureSlugAvailable(slug: string, excludedId?: number) {
    const project = await this.prisma.project.findFirst({
      where: {
        slug,
        ...(excludedId === undefined ? {} : { id: { not: excludedId } }),
      },
      select: { id: true },
    });

    if (project) {
      throw new ConflictException('El slug ya está registrado');
    }
  }

  private async ensureActiveCategory(categoryId: number) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, isActive: true },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException('La categoría no existe o está inactiva');
    }
  }

  private async ensureActiveTechnologies(technologyIds: number[]) {
    if (technologyIds.length === 0) return;

    const technologies = await this.prisma.technology.findMany({
      where: {
        id: { in: technologyIds },
        isActive: true,
      },
      select: { id: true },
    });

    if (technologies.length !== technologyIds.length) {
      throw new BadRequestException('Una o más tecnologías no existen o están inactivas');
    }
  }

  private toAdminProject(project: ProjectWithRelations) {
    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      shortDescription: project.shortDescription,
      description: project.description,
      problem: project.problem,
      solution: project.solution,
      objective: project.objective,
      features: this.toStringArray(project.features),
      category: project.category,
      technologies: project.technologies.map(({ technology }) => technology),
      status: project.status,
      developmentDate: project.developmentDate?.toISOString().slice(0, 10) ?? null,
      clientName: project.clientName,
      demoUrl: project.demoUrl,
      externalUrl: project.externalUrl,
      coverImageUrl: project.coverImageUrl,
      isFeatured: project.isFeatured,
      isPublished: project.isPublished,
      displayOrder: project.displayOrder,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  private toPublicListItem(project: ProjectWithRelations) {
    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      shortDescription: project.shortDescription,
      coverImageUrl: project.coverImageUrl,
      category: project.category,
      technologies: project.technologies.map(({ technology }) => technology),
      isFeatured: project.isFeatured,
      displayOrder: project.displayOrder,
    };
  }

  private toStringArray(features: Prisma.JsonValue): string[] {
    if (!Array.isArray(features)) return [];
    return features.filter((feature): feature is string => typeof feature === 'string');
  }

  private toDatabaseDate(value?: string | null): Date | null {
    return value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null;
  }

  private handleUniqueSlugError(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('El slug ya está registrado');
    }
  }
}
