using AutoMapper;
using TraceNet.DTOs;
using TraceNet.Models;

namespace TraceNet.Infrastructure
{
    public class CableProfile : Profile
    {
        public CableProfile()
        {
            CreateMap<Cable, CableDto>()
                .ForMember(dest => dest.FromDevice, opt => opt.MapFrom(src => src.Connection.FromPort.Device.Name))
                .ForMember(dest => dest.FromPort, opt => opt.MapFrom(src => src.Connection.FromPort.Name))
                .ForMember(dest => dest.ToDevice, opt => opt.MapFrom(src => src.Connection.ToPort.Device.Name))
                .ForMember(dest => dest.ToPort, opt => opt.MapFrom(src => src.Connection.ToPort.Name))
                .ForMember(dest => dest.FromDeviceId, opt => opt.MapFrom(src => src.Connection.FromPort.DeviceId))
                .ForMember(dest => dest.ToDeviceId, opt => opt.MapFrom(src => src.Connection.ToPort.DeviceId))
                .ForMember(dest => dest.Description, opt => opt.MapFrom(src => src.Description));
        }
    }
}
