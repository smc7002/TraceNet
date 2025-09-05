using AutoMapper;
using TraceNet.Models;
using TraceNet.DTOs;

namespace TraceNet.Infrastructure
{
    /// <summary>
    /// AutoMapper profile that defines mapping rules between domain models and DTOs. 
    /// Includes mappings for ports and cable connections.
    /// </summary>
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            CreateMap<Port, PortDto>()
                .ForMember(dest => dest.Connection, opt => opt.MapFrom(src => src.Connection));

            CreateMap<CableConnection, ConnectionDto>()
                .ForMember(dest => dest.CableConnectionId, opt => opt.MapFrom(src => src.CableConnectionId))
                .ForMember(dest => dest.CableId, opt => opt.MapFrom(src => src.CableId))
                .ForMember(dest => dest.ToPortId, opt => opt.MapFrom(src => src.ToPort.PortId))
                .ForMember(dest => dest.ToDeviceId, opt => opt.MapFrom(src => src.ToPort.Device.DeviceId));
        }
    }



}
