import { useTranslation } from 'react-i18next';

/** The active project stays visible while moving between planning modules. */
export default function ProjectContextBar({ shell }) {
    const { t } = useTranslation();
    const projects = shell.projects || [];
    const current = shell.currentProject;
    return <div className="jl-project-context" role="region" aria-label={t('Current project')}>
        <div className="jl-project-context-field">
            <label htmlFor="active-project">{t('Current project')}</label>
            <select id="active-project" className="form-select form-select-sm" value={current?.id || ''} onChange={event => {
                const project = projects.find(item => item.id === event.target.value);
                if (project) shell.setCurrentProject(project);
            }}>
                <option value="" disabled>{t('Select a project')}</option>
                {current && !projects.some(project => project.id === current.id && !project.archived) && <option value={current.id}>{current.name}</option>}
                {projects.filter(project => !project.archived).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
        </div>
        <div className="jl-project-context-actions">
            {(shell.canNavigate?.('menu') ?? true) && <button className="btn btn-sm btn-outline-secondary" onClick={() => shell.navigate('menu')}>{t('Projects')}</button>}
            {current && (shell.canNavigate?.('integrations') ?? true) && <button className="btn btn-sm btn-outline-secondary" onClick={() => shell.navigate('integrations')}>{t('Connected applications')}</button>}
        </div>
    </div>;
}
